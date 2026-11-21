"""Real PyTorch training pipelines for background jobs.

Reuses the existing dataset, model, and Trainer components instead of
duplicating training logic.
"""
from __future__ import annotations

import os
import random
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Protocol

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.datasets import load_dataset, make_dataloader, split_dataset
from src.models import MNISTCNN, CifarCNN, get_pretrained_resnet18
from src.training import Trainer
from src.utils.device import get_device

from ..config import settings


class TrainingCancelled(Exception):
    """Raised by a pipeline when cooperative cancellation is requested."""


@dataclass
class TrainingContext:
    job_id: str
    model_id: str
    dataset_id: str
    config: dict
    artifact_dir: Path
    cancel_event: threading.Event
    log: Callable[[str], None]
    on_epoch_start: Callable[[int, int], None]
    on_batch_end: Callable[[int, int, int], None]
    on_epoch_end: Callable[[dict], None]
    checkpoint_partial_path: Path


@dataclass
class TrainingOutcome:
    history: dict[str, list] = field(default_factory=dict)
    best_val_acc: float | None = None
    epochs_completed: int = 0
    elapsed_seconds: float = 0.0
    device: str = "cpu"


class Pipeline(Protocol):
    def __call__(self, context: TrainingContext) -> TrainingOutcome: ...


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def _check_cancel(context: TrainingContext) -> None:
    if context.cancel_event.is_set():
        raise TrainingCancelled()


def _save_checkpoint_atomic(trainer: Trainer, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    trainer.save_checkpoint(str(temp))
    os.replace(temp, path)


def _train(
    context: TrainingContext,
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    device: torch.device,
) -> TrainingOutcome:
    cfg = context.config
    epochs = int(cfg["epochs"])
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=float(cfg["learning_rate"]),
        weight_decay=float(cfg["weight_decay"]),
    )
    scheduler = None
    if cfg.get("scheduler") == "cosine":
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    trainer = Trainer(
        model,
        train_loader,
        val_loader,
        criterion,
        optimizer,
        device,
        checkpoint_dir=str(context.artifact_dir / "checkpoints"),
    )
    history: dict[str, list] = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}
    best_val_acc: float | None = None
    started = time.perf_counter()

    for epoch in range(1, epochs + 1):
        _check_cancel(context)
        context.on_epoch_start(epoch, epochs)
        epoch_started = time.perf_counter()

        def train_batch(batch_index: int, total_batches: int) -> None:
            _check_cancel(context)
            context.on_batch_end(epoch, batch_index, total_batches)

        train_loss, train_acc = trainer.train_epoch(on_batch_end=train_batch)
        _check_cancel(context)
        val_loss, val_acc = trainer.validate(on_batch_end=lambda _i, _n: _check_cancel(context))

        if scheduler is not None:
            scheduler.step()

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        if best_val_acc is None or val_acc > best_val_acc:
            best_val_acc = val_acc
            _save_checkpoint_atomic(trainer, context.checkpoint_partial_path)

        epoch_seconds = time.perf_counter() - epoch_started
        context.on_epoch_end(
            {
                "epoch": epoch,
                "total_epochs": epochs,
                "train_loss": train_loss,
                "train_acc": train_acc,
                "val_loss": val_loss,
                "val_acc": val_acc,
                "epoch_seconds": epoch_seconds,
            }
        )
        context.log(
            f"epoch {epoch}/{epochs} train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} time={epoch_seconds:.1f}s"
        )

    return TrainingOutcome(
        history=history,
        best_val_acc=best_val_acc,
        epochs_completed=epochs,
        elapsed_seconds=time.perf_counter() - started,
        device=str(device),
    )


def _vision_loaders(dataset_name: str, config: dict) -> tuple[DataLoader, DataLoader]:
    root = str(settings.data_root / "raw")
    full = load_dataset(dataset_name, root=root, train=True, download=False)
    train_set, val_set = split_dataset(full, val_fraction=float(config["val_fraction"]), seed=int(config["seed"]))
    train_loader = make_dataloader(train_set, batch_size=int(config["batch_size"]), shuffle=True, num_workers=int(config["num_workers"]))
    val_loader = make_dataloader(val_set, batch_size=int(config["batch_size"]), shuffle=False, num_workers=int(config["num_workers"]))
    return train_loader, val_loader


def _configure_device(config: dict) -> torch.device:
    if config.get("num_threads"):
        torch.set_num_threads(int(config["num_threads"]))
    return get_device()


def _cifar_cnn_pipeline(context: TrainingContext) -> TrainingOutcome:
    device = _configure_device(context.config)
    _seed_everything(int(context.config["seed"]))
    train_loader, val_loader = _vision_loaders("cifar10", context.config)
    model = CifarCNN(num_classes=10, dropout=0.5).to(device)
    context.log(f"cifar_cnn on {device} batches train={len(train_loader)} val={len(val_loader)}")
    return _train(context, model, train_loader, val_loader, device)


def _mnist_cnn_pipeline(context: TrainingContext) -> TrainingOutcome:
    device = _configure_device(context.config)
    _seed_everything(int(context.config["seed"]))
    train_loader, val_loader = _vision_loaders("mnist", context.config)
    model = MNISTCNN(num_classes=10).to(device)
    context.log(f"mnist_cnn on {device} batches train={len(train_loader)} val={len(val_loader)}")
    return _train(context, model, train_loader, val_loader, device)


def _resnet_transforms(image_size: int, train: bool):
    from torchvision import transforms

    if train:
        return transforms.Compose(
            [
                transforms.RandomResizedCrop(image_size),
                transforms.RandomHorizontalFlip(),
                transforms.ToTensor(),
                transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
            ]
        )
    return transforms.Compose(
        [
            transforms.Resize(image_size),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
        ]
    )


def _resnet_pipeline(context: TrainingContext, fine_tuning: bool) -> TrainingOutcome:
    from torchvision import datasets

    device = _configure_device(context.config)
    _seed_everything(int(context.config["seed"]))
    image_size = int(context.config.get("image_size") or 224)
    root = str(settings.data_root / "raw")

    train_full = datasets.CIFAR10(
        root=root,
        train=True,
        transform=_resnet_transforms(image_size, True),
        download=False,
    )
    n_val = int(len(train_full) * float(context.config["val_fraction"]))
    n_train = len(train_full) - n_val
    generator = torch.Generator().manual_seed(int(context.config["seed"]))
    train_set, _ = torch.utils.data.random_split(train_full, [n_train, n_val], generator=generator)

    val_full = datasets.CIFAR10(
        root=root,
        train=True,
        transform=_resnet_transforms(image_size, False),
        download=False,
    )
    val_set = torch.utils.data.Subset(val_full, train_set.indices)

    train_loader = DataLoader(train_set, batch_size=int(context.config["batch_size"]), shuffle=True, num_workers=int(context.config["num_workers"]))
    val_loader = DataLoader(val_set, batch_size=int(context.config["batch_size"]), shuffle=False, num_workers=int(context.config["num_workers"]))

    if fine_tuning:
        model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False).to(device)
        for name, param in model.named_parameters():
            if not (name.startswith("layer4") or name.startswith("fc")):
                param.requires_grad = False
        context.log(f"resnet18 fine-tuning on {device} image_size={image_size}")
    else:
        model = get_pretrained_resnet18(num_classes=10, freeze_backbone=True).to(device)
        context.log(f"resnet18 feature extraction on {device} image_size={image_size}")

    return _train(context, model, train_loader, val_loader, device)


def _resnet_feature_extraction_pipeline(context: TrainingContext) -> TrainingOutcome:
    return _resnet_pipeline(context, fine_tuning=False)


def _resnet_finetuning_pipeline(context: TrainingContext) -> TrainingOutcome:
    return _resnet_pipeline(context, fine_tuning=True)


PIPELINES: dict[str, Pipeline] = {
    "cifar_cnn": _cifar_cnn_pipeline,
    "mnist_cnn": _mnist_cnn_pipeline,
    "resnet18_feature_extraction": _resnet_feature_extraction_pipeline,
    "resnet18_finetuning": _resnet_finetuning_pipeline,
}


def resolve_pipeline(pipeline_key: str) -> Pipeline:
    try:
        return PIPELINES[pipeline_key]
    except KeyError as exc:
        raise ValueError(f"Unknown training pipeline: {pipeline_key}") from exc
