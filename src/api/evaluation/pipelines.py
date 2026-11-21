"""Real evaluation pipelines over existing checkpoints and dataset splits.

Every pipeline loads a local checkpoint, runs inference on the held-out test
split, and computes metrics from the resulting predictions. No historical
evaluation file is reused and no dataset is downloaded.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.utils.device import get_device

from ..config import settings
from .metrics import compute_classification_metrics

MNIST_MEAN = (0.1307,)
MNIST_STD = (0.3081,)
CIFAR_MEAN = (0.4914, 0.4822, 0.4465)
CIFAR_STD = (0.2023, 0.1994, 0.2010)
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class EvaluationCancelled(Exception):
    """Raised when cooperative cancellation is requested."""


class EvaluationFailure(Exception):
    """Evaluation error with a safe, client-facing message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class EvaluationContext:
    evaluation_id: str
    model_id: str
    dataset_id: str
    family: str
    task: str
    architecture: str
    config: dict
    artifact_dir: Path
    checkpoint_path: Path
    image_size: int | None
    classes: list[str]
    cancel_event: threading.Event
    log: Callable[[str], None]
    on_progress: Callable[[int, int], None]


@dataclass
class EvaluationOutcome:
    task: str
    classes: list[str]
    sample_count: int
    accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    macro: dict
    per_class: dict
    confusion_matrix: list[list[int]]
    duration_seconds: float
    device: str


class Pipeline(Protocol):
    def __call__(self, context: EvaluationContext) -> EvaluationOutcome: ...


def _check_cancel(context: EvaluationContext) -> None:
    if context.cancel_event.is_set():
        raise EvaluationCancelled()


def _progress_reporter(context: EvaluationContext) -> Callable[[int, int], None]:
    def reporter(done: int, total: int) -> None:
        context.on_progress(done, total)

    return reporter


def load_model_state(model: nn.Module, checkpoint_path: Path, device: torch.device) -> None:
    path = Path(checkpoint_path)
    if not path.is_file():
        raise EvaluationFailure("CHECKPOINT_MISSING", "The model checkpoint file is missing.")
    try:
        checkpoint = torch.load(path, map_location=device, weights_only=False)
    except Exception as exc:  # noqa: BLE001 - translate loader failures
        raise EvaluationFailure(
            "INVALID_CHECKPOINT", "The model checkpoint could not be read or is corrupted."
        ) from exc
    if not isinstance(checkpoint, dict) or "model_state_dict" not in checkpoint:
        raise EvaluationFailure(
            "INVALID_CHECKPOINT", "The checkpoint does not contain a model state dictionary."
        )
    try:
        model.load_state_dict(checkpoint["model_state_dict"])
    except (RuntimeError, TypeError, ValueError) as exc:
        raise EvaluationFailure(
            "INCOMPATIBLE_CHECKPOINT",
            "The checkpoint is not compatible with the registered model architecture.",
        ) from exc


def build_image_model(family: str) -> nn.Module:
    from src.models import CifarCNN, MNISTCNN, get_pretrained_resnet18

    if family == "mnist_cnn":
        return MNISTCNN(num_classes=10)
    if family == "cifar_cnn":
        return CifarCNN(num_classes=10)
    if family == "resnet18":
        return get_pretrained_resnet18(num_classes=10, freeze_backbone=False, weights=None)
    raise EvaluationFailure("UNSUPPORTED_MODEL", "No image evaluation adapter exists for this model.")


def _image_transform(family: str, image_size: int):
    from torchvision import transforms

    if family == "mnist_cnn":
        return transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize(MNIST_MEAN, MNIST_STD),
            ]
        )
    if family == "cifar_cnn":
        return transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize(CIFAR_MEAN, CIFAR_STD),
            ]
        )
    if family == "resnet18":
        return transforms.Compose(
            [
                transforms.Resize(image_size),
                transforms.CenterCrop(image_size),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )
    raise EvaluationFailure("UNSUPPORTED_MODEL", "No image preprocessing exists for this model.")


def load_image_test_dataset(context: EvaluationContext):
    from torchvision import datasets

    root = str(settings.data_root / "raw")
    transform = _image_transform(context.family, int(context.image_size or 32))
    try:
        if context.dataset_id == "mnist":
            dataset = datasets.MNIST(root=root, train=False, transform=transform, download=False)
        elif context.dataset_id == "cifar10":
            dataset = datasets.CIFAR10(root=root, train=False, transform=transform, download=False)
        else:
            raise EvaluationFailure(
                "INCOMPATIBLE_DATASET", "No image test split is available for this dataset."
            )
    except EvaluationFailure:
        raise
    except Exception as exc:  # noqa: BLE001 - dataset loaders raise varied errors
        raise EvaluationFailure(
            "DATASET_UNAVAILABLE", "The dataset test split could not be loaded from local storage."
        ) from exc

    max_samples = context.config.get("max_samples")
    if max_samples:
        from torch.utils.data import Subset

        dataset = Subset(dataset, range(min(int(max_samples), len(dataset))))
    if len(dataset) == 0:
        raise EvaluationFailure("EMPTY_DATASET", "The evaluation dataset contains no samples.")
    return dataset


@torch.no_grad()
def collect_predictions(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    cancel_event: threading.Event,
    progress: Callable[[int, int], None],
) -> tuple[torch.Tensor, torch.Tensor]:
    """Run inference and return concatenated predictions and targets."""
    model.eval()
    total = len(loader.dataset) if hasattr(loader, "dataset") else 0
    predictions: list[torch.Tensor] = []
    targets: list[torch.Tensor] = []
    seen = 0

    for inputs, labels in loader:
        if cancel_event.is_set():
            raise EvaluationCancelled()
        outputs = model(inputs.to(device))
        predictions.append(outputs.argmax(dim=1).detach().cpu())
        targets.append(labels.detach().cpu())
        seen += int(labels.size(0))
        progress(seen, total or seen)

    if not predictions:
        raise EvaluationFailure("EMPTY_DATASET", "The evaluation dataset contains no samples.")
    return torch.cat(predictions), torch.cat(targets)


def _outcome(
    context: EvaluationContext,
    preds: torch.Tensor,
    targets: torch.Tensor,
    duration: float,
    device: str,
) -> EvaluationOutcome:
    metrics = compute_classification_metrics(preds, targets, context.classes)
    return EvaluationOutcome(
        task=context.task,
        classes=metrics["classes"],
        sample_count=metrics["sample_count"],
        accuracy=metrics["accuracy"],
        macro_precision=metrics["macro_precision"],
        macro_recall=metrics["macro_recall"],
        macro_f1=metrics["macro_f1"],
        macro=metrics["macro"],
        per_class=metrics["per_class"],
        confusion_matrix=metrics["confusion_matrix"],
        duration_seconds=duration,
        device=device,
    )


def evaluate_image(context: EvaluationContext) -> EvaluationOutcome:
    started = time.perf_counter()
    device = get_device()
    _check_cancel(context)

    context.log(f"loading {context.architecture} checkpoint for {context.model_id}")
    model = build_image_model(context.family).to(device)
    load_model_state(model, context.checkpoint_path, device)

    context.log("loading held-out test split")
    dataset = load_image_test_dataset(context)
    context.log(f"evaluating {len(dataset)} test samples on {device}")
    loader = DataLoader(
        dataset,
        batch_size=int(context.config["batch_size"]),
        shuffle=False,
        num_workers=int(context.config.get("num_workers", 0)),
    )
    preds, targets = collect_predictions(
        model, loader, device, context.cancel_event, _progress_reporter(context)
    )
    _check_cancel(context)

    outcome = _outcome(context, preds, targets, time.perf_counter() - started, str(device))
    context.log(
        f"evaluation complete samples={outcome.sample_count} accuracy={outcome.accuracy:.4f} "
        f"macro_f1={outcome.macro_f1:.4f}"
    )
    return outcome


def _load_imdb_test_split(max_samples: int | None):
    from datasets import load_dataset

    dataset = load_dataset("stanfordnlp/imdb", split="test")
    if max_samples:
        dataset = dataset.select(range(min(int(max_samples), len(dataset))))
    if len(dataset) == 0:
        raise EvaluationFailure("EMPTY_DATASET", "The evaluation dataset contains no samples.")
    return dataset


@torch.no_grad()
def collect_text_predictions(
    model,
    loader: DataLoader,
    device: torch.device,
    cancel_event: threading.Event,
    progress: Callable[[int, int], None],
) -> tuple[torch.Tensor, torch.Tensor]:
    total = len(loader.dataset) if hasattr(loader, "dataset") else 0
    predictions: list[torch.Tensor] = []
    targets: list[torch.Tensor] = []
    seen = 0
    for batch in loader:
        if cancel_event.is_set():
            raise EvaluationCancelled()
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        outputs = model(input_ids=input_ids, attention_mask=attention_mask)
        predictions.append(outputs.logits.argmax(dim=-1).detach().cpu())
        targets.append(batch["labels"].detach().cpu())
        seen += int(batch["labels"].size(0))
        progress(seen, total or seen)
    if not predictions:
        raise EvaluationFailure("EMPTY_DATASET", "The evaluation dataset contains no samples.")
    return torch.cat(predictions), torch.cat(targets)


def evaluate_text(context: EvaluationContext) -> EvaluationOutcome:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    from src.nlp.imdb import TokenizedTextDataset

    started = time.perf_counter()
    device = torch.device("cpu")
    _check_cancel(context)
    model_name = "distilbert-base-uncased"
    max_length = 128

    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name, num_labels=len(context.classes), local_files_only=True
        ).to(device)
    except Exception as exc:  # noqa: BLE001 - missing local model files
        raise EvaluationFailure(
            "MODEL_UNAVAILABLE",
            "The DistilBERT base model or tokenizer is not available in the local cache.",
        ) from exc

    context.log(f"loading {context.model_id} checkpoint")
    load_model_state(model, context.checkpoint_path, device)

    context.log("loading IMDb held-out test split")
    try:
        raw = _load_imdb_test_split(context.config.get("max_samples"))
    except EvaluationFailure:
        raise
    except Exception as exc:  # noqa: BLE001 - datasets raises varied errors
        raise EvaluationFailure(
            "DATASET_UNAVAILABLE", "The IMDb test split could not be loaded from local storage."
        ) from exc

    dataset = TokenizedTextDataset(
        [record["text"] for record in raw],
        [record["label"] for record in raw],
        tokenizer,
        max_length,
    )
    context.log(f"evaluating {len(dataset)} test samples on {device}")
    loader = DataLoader(dataset, batch_size=int(context.config["batch_size"]), shuffle=False)
    preds, targets = collect_text_predictions(
        model, loader, device, context.cancel_event, _progress_reporter(context)
    )
    _check_cancel(context)

    outcome = _outcome(context, preds, targets, time.perf_counter() - started, str(device))
    context.log(
        f"evaluation complete samples={outcome.sample_count} accuracy={outcome.accuracy:.4f} "
        f"macro_f1={outcome.macro_f1:.4f}"
    )
    return outcome


PIPELINES: dict[str, Pipeline] = {
    "mnist_cnn": evaluate_image,
    "cifar_cnn": evaluate_image,
    "resnet18": evaluate_image,
    "distilbert": evaluate_text,
}


def resolve_evaluation_pipeline(family: str) -> Pipeline:
    try:
        return PIPELINES[family]
    except KeyError as exc:
        raise EvaluationFailure(
            "UNSUPPORTED_MODEL", "No evaluation pipeline exists for this model."
        ) from exc
