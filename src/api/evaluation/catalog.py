"""Supported evaluation models, dataset compatibility, and config validation."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from ..errors import APIError
from ..schemas_evaluation import EvaluationConfig


@dataclass(frozen=True)
class EvaluationSpec:
    model_id: str
    display_name: str
    dataset_id: str
    family: str
    architecture: str
    task: str
    image_size: int | None = None


EVALUATION_SPECS: tuple[EvaluationSpec, ...] = (
    EvaluationSpec(
        model_id="mnist_cnn",
        display_name="MNIST CNN Baseline",
        dataset_id="mnist",
        family="mnist_cnn",
        architecture="MNISTCNN",
        task="image_classification",
        image_size=28,
    ),
    EvaluationSpec(
        model_id="cifar10_custom_cnn",
        display_name="CIFAR-10 Custom CNN",
        dataset_id="cifar10",
        family="cifar_cnn",
        architecture="CifarCNN",
        task="image_classification",
        image_size=32,
    ),
    EvaluationSpec(
        model_id="cifar10_custom_cnn_baseline",
        display_name="CIFAR-10 Custom CNN (1 epoch baseline)",
        dataset_id="cifar10",
        family="cifar_cnn",
        architecture="CifarCNN",
        task="image_classification",
        image_size=32,
    ),
    EvaluationSpec(
        model_id="resnet18_feature_extraction",
        display_name="ResNet18 Feature Extraction",
        dataset_id="cifar10",
        family="resnet18",
        architecture="ResNet18",
        task="image_classification",
        image_size=224,
    ),
    EvaluationSpec(
        model_id="resnet18_finetuned",
        display_name="ResNet18 Fine-tuned",
        dataset_id="cifar10",
        family="resnet18",
        architecture="ResNet18",
        task="image_classification",
        image_size=128,
    ),
    EvaluationSpec(
        model_id="distilbert_imdb_finetuned",
        display_name="DistilBERT IMDb Sentiment",
        dataset_id="imdb",
        family="distilbert",
        architecture="DistilBERT",
        task="sentiment_analysis",
        image_size=None,
    ),
)

_BY_ID = {spec.model_id: spec for spec in EVALUATION_SPECS}


def resolve_evaluation_spec(model: str, dataset: str) -> EvaluationSpec:
    key = model.strip().lower()
    spec = _BY_ID.get(key)
    if spec is None:
        raise APIError(
            "NOT_FOUND",
            f"Model '{model}' is not supported for evaluation",
            404,
            {"supported_models": [s.model_id for s in EVALUATION_SPECS]},
        )
    dataset_id = dataset.strip().lower()
    if dataset_id != spec.dataset_id:
        raise APIError(
            "VALIDATION_ERROR",
            f"Model '{spec.model_id}' cannot be evaluated on dataset '{dataset}'",
            422,
            {"supported_datasets": [spec.dataset_id]},
        )
    return spec


def resolve_evaluation_config(spec: EvaluationSpec, overrides: dict[str, Any] | None) -> dict[str, Any]:
    try:
        config = EvaluationConfig.model_validate(overrides or {})
    except ValidationError as exc:
        raise APIError(
            "VALIDATION_ERROR",
            "Invalid evaluation configuration",
            422,
            {"errors": exc.errors()},
        ) from exc
    return config.model_dump()


def presets() -> list[dict[str, Any]]:
    return [
        {
            "model": spec.model_id,
            "dataset": spec.dataset_id,
            "display_name": spec.display_name,
            "architecture": spec.architecture,
            "task": spec.task,
            "default_config": EvaluationConfig().model_dump(),
        }
        for spec in EVALUATION_SPECS
    ]
