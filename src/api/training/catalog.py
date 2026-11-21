"""Supported training models, dataset compatibility, and config resolution."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from ..config import settings
from ..errors import APIError
from ..schemas_training import TrainingConfig

CONFIG_FIELDS = set(TrainingConfig.model_fields)


@dataclass(frozen=True)
class ModelSpec:
    model_id: str
    display_name: str
    architecture: str
    pipeline: str
    datasets: tuple[str, ...]
    default_config: str
    fixed_image_size: int | None = None


MODEL_SPECS: tuple[ModelSpec, ...] = (
    ModelSpec(
        model_id="cifar_cnn",
        display_name="CIFAR-10 Custom CNN",
        architecture="CifarCNN",
        pipeline="cifar_cnn",
        datasets=("cifar10",),
        default_config="cifar10_5epoch.json",
        fixed_image_size=32,
    ),
    ModelSpec(
        model_id="resnet18_feature_extraction",
        display_name="ResNet18 Feature Extraction",
        architecture="ResNet18",
        pipeline="resnet18_feature_extraction",
        datasets=("cifar10",),
        default_config="resnet18_feature_extraction.json",
    ),
    ModelSpec(
        model_id="resnet18_finetuning",
        display_name="ResNet18 Fine-tuning",
        architecture="ResNet18",
        pipeline="resnet18_finetuning",
        datasets=("cifar10",),
        default_config="resnet18_finetuning_optimized.json",
    ),
    ModelSpec(
        model_id="mnist_cnn",
        display_name="MNIST CNN",
        architecture="MNISTCNN",
        pipeline="mnist_cnn",
        datasets=("mnist",),
        default_config="mnist_cpu.json",
        fixed_image_size=28,
    ),
)

ALIASES = {
    "cifar10_custom_cnn": "cifar_cnn",
    "cifar10_custom_cnn_baseline": "cifar_cnn",
    "cifar10_cnn": "cifar_cnn",
    "resnet18_feature_extractor": "resnet18_feature_extraction",
    "resnet18_finetuned": "resnet18_finetuning",
    "resnet18_fine_tuning": "resnet18_finetuning",
}

_BY_ID = {spec.model_id: spec for spec in MODEL_SPECS}


def normalize_model_id(model: str) -> str:
    key = model.strip().lower()
    return ALIASES.get(key, key)


def resolve_spec(model: str) -> ModelSpec:
    spec = _BY_ID.get(normalize_model_id(model))
    if spec is None:
        raise APIError(
            "NOT_FOUND",
            f"Training model '{model}' is not supported",
            404,
            {"supported_models": [s.model_id for s in MODEL_SPECS]},
        )
    return spec


def validate_dataset_compatibility(spec: ModelSpec, dataset_id: str) -> str:
    dataset = dataset_id.strip().lower()
    if dataset not in spec.datasets:
        raise APIError(
            "VALIDATION_ERROR",
            f"Model '{spec.model_id}' is not compatible with dataset '{dataset_id}'",
            422,
            {"supported_datasets": list(spec.datasets)},
        )
    return dataset


def _read_preset_file(spec: ModelSpec) -> dict[str, Any]:
    path: Path = settings.config_root / spec.default_config
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {key: value for key, value in data.items() if key in CONFIG_FIELDS and value is not None}


def default_config(spec: ModelSpec) -> dict[str, Any]:
    base = TrainingConfig().model_dump()
    base.update(_read_preset_file(spec))
    if spec.fixed_image_size is not None:
        base["image_size"] = spec.fixed_image_size
    return TrainingConfig.model_validate(base).model_dump()


def resolve_config(spec: ModelSpec, overrides: dict[str, Any] | None) -> dict[str, Any]:
    merged = default_config(spec)
    provided = {key: value for key, value in (overrides or {}).items() if value is not None}

    if spec.fixed_image_size is not None:
        supplied_size = provided.get("image_size")
        if supplied_size is not None and supplied_size != spec.fixed_image_size:
            raise APIError(
                "VALIDATION_ERROR",
                f"Model '{spec.model_id}' requires image_size={spec.fixed_image_size}",
                422,
                {"image_size": supplied_size, "required_image_size": spec.fixed_image_size},
            )
        provided.pop("image_size", None)

    merged.update(provided)
    try:
        config = TrainingConfig.model_validate(merged)
    except ValidationError as exc:
        raise APIError("VALIDATION_ERROR", "Invalid training configuration", 422, {"errors": exc.errors()}) from exc
    return config.model_dump()


def presets() -> list[dict[str, Any]]:
    return [
        {
            "model": spec.model_id,
            "dataset": spec.datasets[0],
            "display_name": spec.display_name,
            "architecture": spec.architecture,
            "default_config": default_config(spec),
        }
        for spec in MODEL_SPECS
    ]
