"""Dataset discovery, metadata, statistics, and validation."""
from __future__ import annotations

from pathlib import Path

from ..config import settings
from ..errors import APIError
from .artifacts import directory_usage

CIFAR10_CLASSES = ["airplane", "automobile", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"]
MNIST_CLASSES = [str(i) for i in range(10)]


def _hf_cache_root() -> Path:
    return Path.home() / ".cache" / "huggingface" / "hub"


def _dataset_defs() -> list[dict]:
    return [
        {
            "dataset_id": "mnist",
            "display_name": "MNIST",
            "description": "Handwritten digit classification dataset.",
            "dataset_type": "image",
            "task": "image_classification",
            "source": "torchvision",
            "root": settings.data_root / "raw" / "MNIST",
            "required": ["raw/train-images-idx3-ubyte", "raw/train-labels-idx1-ubyte", "raw/t10k-images-idx3-ubyte", "raw/t10k-labels-idx1-ubyte"],
            "train_size": 60000,
            "test_size": 10000,
            "val_fraction": 0.1,
            "classes": MNIST_CLASSES,
            "input": {"channels": 1, "height": 28, "width": 28},
            "preprocessing": {"normalize_mean": [0.1307], "normalize_std": [0.3081], "augmentation": "RandomAffine"},
            "config": "configs/mnist_cpu.json",
        },
        {
            "dataset_id": "cifar10",
            "display_name": "CIFAR-10",
            "description": "10-class 32x32 color image classification dataset.",
            "dataset_type": "image",
            "task": "image_classification",
            "source": "torchvision",
            "root": settings.data_root / "raw" / "cifar-10-batches-py",
            "required": ["batches.meta", "data_batch_1", "data_batch_2", "data_batch_3", "data_batch_4", "data_batch_5", "test_batch"],
            "train_size": 50000,
            "test_size": 10000,
            "val_fraction": 0.1,
            "classes": CIFAR10_CLASSES,
            "input": {"channels": 3, "height": 32, "width": 32},
            "preprocessing": {"normalize_mean": [0.4914, 0.4822, 0.4465], "normalize_std": [0.2023, 0.1994, 0.2010], "augmentation": "RandomCrop + RandomHorizontalFlip"},
            "config": "configs/cifar10_5epoch.json",
        },
        {
            "dataset_id": "imdb",
            "display_name": "IMDb Movie Reviews",
            "description": "Binary sentiment movie-review dataset from Hugging Face.",
            "dataset_type": "text",
            "task": "sentiment_analysis",
            "source": "huggingface:stanfordnlp/imdb",
            "root": _hf_cache_root() / "datasets--stanfordnlp--imdb",
            "required": [],
            "train_size": 25000,
            "test_size": 25000,
            "val_fraction": 0.1,
            "classes": ["NEGATIVE", "POSITIVE"],
            "input": {"text": True, "max_length": 128},
            "preprocessing": {"tokenizer": "distilbert-base-uncased", "truncation": True, "padding": "max_length"},
            "config": "configs/distilbert_imdb.json",
        },
    ]


def _availability(entry: dict) -> tuple[bool, list[str], int, int]:
    root: Path = entry["root"]
    missing = [rel for rel in entry["required"] if not (root / rel).exists()]
    exists = root.exists() and root.is_dir()
    size, files = directory_usage(root)
    return exists and not missing, missing, size, files


def _payload(entry: dict) -> dict:
    available, missing, size, files = _availability(entry)
    return {
        "dataset_id": entry["dataset_id"],
        "display_name": entry["display_name"],
        "description": entry["description"],
        "dataset_type": entry["dataset_type"],
        "task": entry["task"],
        "source": entry["source"],
        "available": available,
        "status": "available" if available else "missing",
        "missing_files": missing,
        "local_path": str(entry["root"]),
        "local_size_bytes": size,
        "local_file_count": files,
        "train_size": entry["train_size"],
        "test_size": entry["test_size"],
        "val_fraction": entry["val_fraction"],
        "num_classes": len(entry["classes"]),
        "classes": entry["classes"],
        "input": entry["input"],
        "preprocessing": entry["preprocessing"],
        "config_path": str(settings.config_root.parent / entry["config"]),
    }


def list_datasets() -> list[dict]:
    return [_payload(e) for e in _dataset_defs()]


def get_dataset(dataset_id: str) -> dict:
    for entry in _dataset_defs():
        if entry["dataset_id"] == dataset_id:
            return _payload(entry)
    raise APIError("NOT_FOUND", f"Dataset '{dataset_id}' not found", 404)


def statistics(dataset_id: str) -> dict:
    detail = get_dataset(dataset_id)
    return {
        "dataset_id": dataset_id,
        "available": detail["available"],
        "local_size_bytes": detail["local_size_bytes"],
        "local_file_count": detail["local_file_count"],
        "train_size": detail["train_size"],
        "test_size": detail["test_size"],
        "expected_val_size": int(detail["train_size"] * detail["val_fraction"]),
        "expected_train_after_split": detail["train_size"] - int(detail["train_size"] * detail["val_fraction"]),
        "num_classes": detail["num_classes"],
        "classes": detail["classes"],
    }


def validate_dataset(dataset_id: str) -> dict:
    detail = get_dataset(dataset_id)
    checks = [
        {"name": "supported_id", "passed": True},
        {"name": "local_files", "passed": detail["available"]},
        {"name": "split_totals", "passed": detail["train_size"] > 0 and detail["test_size"] > 0},
        {"name": "class_metadata", "passed": detail["num_classes"] == len(detail["classes"]) > 0},
        {"name": "input_spec", "passed": bool(detail["input"])},
    ]
    return {
        "dataset_id": dataset_id,
        "valid": all(c["passed"] for c in checks),
        "status": "valid" if all(c["passed"] for c in checks) else "invalid",
        "checks": checks,
        "missing_files": detail["missing_files"],
    }
