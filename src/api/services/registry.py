"""Model registry discovery over real local artifacts."""
from __future__ import annotations

from pathlib import Path

from ..config import settings
from ..errors import APIError
from .artifacts import load_json_file, resolve_allowed_path, safe_stat


CATALOG = [
    {
        "model_id": "cifar10_custom_cnn",
        "display_name": "CIFAR-10 Custom CNN",
        "architecture": "CifarCNN",
        "task": "image_classification",
        "checkpoint": "artifacts/cifar10_improved.pt",
        "config": "configs/cifar10_5epoch.json",
        "evaluation": "artifacts/cifar10_improved_evaluation.json",
    },
    {
        "model_id": "cifar10_custom_cnn_baseline",
        "display_name": "CIFAR-10 Custom CNN (1 epoch baseline)",
        "architecture": "CifarCNN",
        "task": "image_classification",
        "checkpoint": "artifacts/cifar10_best.pt",
        "config": "configs/cifar10.json",
        "evaluation": "artifacts/cifar10_evaluation.json",
    },
    {
        "model_id": "mnist_cnn",
        "display_name": "MNIST CNN Baseline",
        "architecture": "MNISTCNN",
        "task": "image_classification",
        "checkpoint": "artifacts/mnist_baseline.pt",
        "config": "configs/mnist_cpu.json",
        "evaluation": None,
    },
    {
        "model_id": "resnet18_feature_extraction",
        "display_name": "ResNet18 Feature Extraction",
        "architecture": "ResNet18",
        "task": "image_classification",
        "checkpoint": "artifacts/resnet18_feature_extractor.pt",
        "config": "configs/resnet18_feature_extraction.json",
        "evaluation": "artifacts/resnet18_feature_extractor_evaluation.json",
    },
    {
        "model_id": "resnet18_finetuned",
        "display_name": "ResNet18 Fine-tuned",
        "architecture": "ResNet18",
        "task": "image_classification",
        "checkpoint": "artifacts/resnet18_finetuned.pt",
        "config": "configs/resnet18_finetuning_optimized.json",
        "evaluation": "artifacts/resnet18_finetuned_evaluation.json",
    },
    {
        "model_id": "distilbert_imdb_finetuned",
        "display_name": "DistilBERT IMDb Sentiment",
        "architecture": "DistilBERT",
        "task": "sentiment_analysis",
        "checkpoint": "artifacts/distilbert_imdb_finetuned.pt",
        "config": "configs/distilbert_imdb.json",
        "evaluation": "artifacts/distilbert_imdb_evaluation.json",
    },
]

CAPABILITIES = {
    "image_classification": ["predict", "evaluate", "top_k"],
    "sentiment_analysis": ["sentiment", "batch"],
}


def _project_path(relative: str | None) -> Path | None:
    if not relative:
        return None
    return settings.artifact_root.parent / relative


def _metrics_from(evaluation_path: Path | None) -> dict:
    metrics = {"accuracy": None, "macro_f1": None, "macro_precision": None, "macro_recall": None}
    if evaluation_path and evaluation_path.exists():
        try:
            data = load_json_file(evaluation_path)
            per_class = data.get("per_class", {})
            macro = per_class.get("macro", {}) if isinstance(per_class, dict) else {}
            metrics["accuracy"] = data.get("accuracy")
            metrics["macro_f1"] = macro.get("f1", data.get("macro_f1"))
            metrics["macro_precision"] = macro.get("precision", data.get("macro_precision"))
            metrics["macro_recall"] = macro.get("recall", data.get("macro_recall"))
        except APIError:
            pass
    return metrics


def _config_for(config_path: Path | None) -> dict:
    if config_path and config_path.exists():
        try:
            return load_json_file(config_path)
        except APIError:
            return {}
    return {}


def list_models() -> list[dict]:
    models = []
    for entry in CATALOG:
        ckpt = _project_path(entry["checkpoint"])
        config = _project_path(entry["config"])
        evaluation = _project_path(entry["evaluation"])
        status, error = "available", None
        size = None
        if ckpt is None or not ckpt.exists():
            status, error = "missing", "Checkpoint file not found"
        else:
            try:
                resolved = resolve_allowed_path(ckpt)
                info = safe_stat(resolved)
                size = info["size_bytes"]
            except APIError as exc:
                status, error = "invalid", exc.message
        models.append({
            "model_id": entry["model_id"],
            "display_name": entry["display_name"],
            "architecture": entry["architecture"],
            "task": entry["task"],
            "artifact_path": str(ckpt) if ckpt else "",
            "checkpoint_size_bytes": size,
            "config_path": str(config) if config else None,
            "evaluation_path": str(evaluation) if evaluation else None,
            "metrics": _metrics_from(evaluation),
            "available": status == "available",
            "status": status,
            "error": error,
        })
    models.extend(job_models(settings.artifact_root))
    return models


def job_models(artifact_root: Path | None = None) -> list[dict]:
    """Discover models produced by successfully completed training jobs."""
    root = Path(artifact_root or settings.artifact_root) / "app"
    if not root.exists() or not root.is_dir():
        return []
    job_root = root.resolve()
    discovered: list[tuple[str, dict]] = []
    for metadata_path in root.glob("*/model.json"):
        try:
            entry = load_json_file(metadata_path)
        except APIError:
            continue
        checkpoint = Path(str(entry.get("checkpoint_path", "")))
        metrics_path = Path(str(entry.get("metrics_path", ""))) if entry.get("metrics_path") else None
        status, error, size = "missing", "Checkpoint file not found", None
        if checkpoint.exists():
            resolved = checkpoint.resolve()
            if resolved == job_root or job_root in resolved.parents:
                size = safe_stat(resolved)["size_bytes"]
                status, error = "available", None
            else:
                status, error = "invalid", "Checkpoint is outside the job artifact root"
        discovered.append(
            (
                str(entry.get("created_at", "")),
                {
                    "model_id": entry.get("model_id", metadata_path.parent.name),
                    "display_name": entry.get("display_name", metadata_path.parent.name),
                    "architecture": entry.get("architecture", "unknown"),
                    "task": entry.get("task", "image_classification"),
                    "artifact_path": str(checkpoint) if checkpoint.name else "",
                    "checkpoint_size_bytes": size,
                    "config_path": entry.get("config_path"),
                    "evaluation_path": str(metrics_path) if metrics_path else None,
                    "metrics": _metrics_from(metrics_path),
                    "available": status == "available",
                    "status": status,
                    "error": error,
                },
            )
        )
    discovered.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in discovered]


def get_model(model_id: str) -> dict:
    for model in list_models():
        if model["model_id"] == model_id:
            return model
    raise APIError("NOT_FOUND", f"Model '{model_id}' not found", 404)


def model_capabilities() -> list[dict]:
    return [
        {
            "model_id": m["model_id"],
            "display_name": m["display_name"],
            "task": m["task"],
            "capabilities": CAPABILITIES.get(m["task"], []),
        }
        for m in list_models()
    ]
