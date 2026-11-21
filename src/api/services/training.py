"""Background training job service backed by existing PyTorch pipelines."""
from __future__ import annotations

import json
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import datasets, transforms

from ..config import settings
from ..errors import APIError
from . import training_repository as repo

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="deepvision-train")
_cancel_events: dict[str, threading.Event] = {}
_logs: dict[str, list[str]] = {}
_lock = threading.Lock()

MODEL_SPECS = {
    "mnist_cnn": {"dataset": "mnist", "architecture": "MNISTCNN", "image_size": 28},
    "cifar10_custom_cnn": {"dataset": "cifar10", "architecture": "CifarCNN", "image_size": 32},
    "cifar10_custom_cnn_baseline": {"dataset": "cifar10", "architecture": "CifarCNN", "image_size": 32},
    "resnet18_feature_extraction": {"dataset": "cifar10", "architecture": "ResNet18", "image_size": 128},
    "resnet18_finetuned": {"dataset": "cifar10", "architecture": "ResNet18", "image_size": 128},
}

DEFAULT_CONFIG = {"epochs": 1, "batch_size": 32, "learning_rate": 0.001, "weight_decay": 0.0005, "val_fraction": 0.1, "seed": 42, "num_workers": 0, "image_size": 128}


def _validate_config(config: dict) -> dict:
    merged = {**DEFAULT_CONFIG, **config}
    epochs = int(merged["epochs"])
    batch = int(merged["batch_size"])
    lr = float(merged["learning_rate"])
    val_fraction = float(merged["val_fraction"])
    image_size = int(merged.get("image_size", 128))
    if not 1 <= epochs <= 20:
        raise APIError("VALIDATION_ERROR", "epochs must be between 1 and 20", 422)
    if not 1 <= batch <= 512:
        raise APIError("VALIDATION_ERROR", "batch_size must be between 1 and 512", 422)
    if lr <= 0:
        raise APIError("VALIDATION_ERROR", "learning_rate must be positive", 422)
    if not 0 < val_fraction < 0.5:
        raise APIError("VALIDATION_ERROR", "val_fraction must be between 0 and 0.5", 422)
    if not 32 <= image_size <= 224:
        raise APIError("VALIDATION_ERROR", "image_size must be between 32 and 224", 422)
    merged.update(epochs=epochs, batch_size=batch, learning_rate=lr, val_fraction=val_fraction, image_size=image_size)
    return merged


def _log(job_id: str, message: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {message}"
    with _lock:
        _logs.setdefault(job_id, []).append(line)
    path = settings.artifact_root / "app" / job_id / "training.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line, flush=True)


def get_logs(job_id: str, since: int = 0) -> list[str]:
    with _lock:
        return _logs.get(job_id, [])[since:]


def create_job(model_id: str, dataset_id: str, config: dict) -> dict:
    spec = MODEL_SPECS.get(model_id)
    if spec is None:
        raise APIError("NOT_FOUND", f"Unsupported model '{model_id}'", 404)
    if spec["dataset"] != dataset_id:
        raise APIError("VALIDATION_ERROR", f"Model '{model_id}' requires dataset '{spec['dataset']}'", 422)
    config = _validate_config(config)
    if repo.running_count() >= 1:
        raise APIError("CONFLICT", "A training job is already running", 409)
    job_id = f"job_{uuid.uuid4().hex[:10]}"
    artifact_dir = settings.artifact_root / "app" / job_id
    artifact_dir.mkdir(parents=True, exist_ok=False)
    (artifact_dir / "config.json").write_text(json.dumps({"model_id": model_id, "dataset_id": dataset_id, "config": config}, indent=2))
    job = repo.create_job(job_id, model_id, dataset_id, config, config["epochs"], str(artifact_dir))
    _cancel_events[job_id] = threading.Event()
    _log(job_id, f"Job created for {model_id} on {dataset_id}")
    _executor.submit(_run_job, job_id)
    return job


def cancel_job(job_id: str) -> dict:
    job = repo.get_job(job_id)
    if not job:
        raise APIError("NOT_FOUND", f"Job '{job_id}' not found", 404)
    if job["status"] not in ("QUEUED", "RUNNING"):
        raise APIError("CONFLICT", f"Job is {job['status']} and cannot be cancelled", 409)
    repo.request_cancel(job_id)
    event = _cancel_events.get(job_id)
    if event:
        event.set()
    _log(job_id, "Cancellation requested")
    return repo.get_job(job_id)


def _build_model(model_id: str):
    from src.models import CifarCNN, MNISTCNN, get_pretrained_resnet18

    if model_id == "mnist_cnn":
        return MNISTCNN(num_classes=10)
    if model_id in ("cifar10_custom_cnn", "cifar10_custom_cnn_baseline"):
        return CifarCNN(num_classes=10)
    if model_id == "resnet18_feature_extraction":
        return get_pretrained_resnet18(num_classes=10, freeze_backbone=True)
    model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False)
    for name, param in model.named_parameters():
        if not (name.startswith("layer4") or name.startswith("fc")):
            param.requires_grad = False
    return model


def _cifar_transforms(image_size: int, train: bool):
    if train:
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.RandomCrop(image_size, padding=4),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)),
        ])
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)),
    ])


def _run_job(job_id: str) -> None:
    job = repo.get_job(job_id)
    if not job:
        return
    event = _cancel_events[job_id]
    cfg = job["config"]
    try:
        repo.mark_started(job_id)
        _log(job_id, "Training started")
        from src.datasets import load_dataset, make_dataloader
        from src.training.trainer import Trainer

        if job["dataset_id"] == "mnist":
            train_full = load_dataset("mnist", train=True, download=False)
            test_set = load_dataset("mnist", train=False, download=False)
        else:
            size = cfg["image_size"] if job["model_id"].startswith("resnet") else 32
            train_full = datasets.CIFAR10(root=str(settings.data_root / "raw"), train=True, transform=_cifar_transforms(size, True), download=False)
            test_set = datasets.CIFAR10(root=str(settings.data_root / "raw"), train=False, transform=_cifar_transforms(size, False), download=False)

        n_val = int(len(train_full) * cfg["val_fraction"])
        generator = torch.Generator().manual_seed(cfg["seed"])
        train_set, val_indices = torch.utils.data.random_split(train_full, [len(train_full) - n_val, n_val], generator=generator)
        if job["dataset_id"] == "mnist":
            val_full = load_dataset("mnist", train=True, download=False)
        else:
            size = cfg["image_size"] if job["model_id"].startswith("resnet") else 32
            val_full = datasets.CIFAR10(root=str(settings.data_root / "raw"), train=True, transform=_cifar_transforms(size, False), download=False)
        val_set = torch.utils.data.Subset(val_full, list(val_indices.indices))

        train_loader = make_dataloader(train_set, batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
        val_loader = make_dataloader(val_set, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

        device = torch.device("cpu")
        model = _build_model(job["model_id"]).to(device)
        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg["learning_rate"], weight_decay=cfg["weight_decay"])
        trainer = Trainer(model, train_loader, val_loader, criterion, optimizer, device, checkpoint_dir=str(settings.artifact_root / "app" / job_id))

        history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}
        best_acc = -1.0
        started = time.perf_counter()
        for epoch in range(cfg["epochs"]):
            if event.is_set():
                raise _Cancelled()
            t0 = time.perf_counter()
            train_loss, train_acc = trainer.train_epoch()
            val_loss, val_acc = trainer.validate()
            elapsed = time.perf_counter() - t0
            history["train_loss"].append(train_loss)
            history["train_acc"].append(train_acc)
            history["val_loss"].append(val_loss)
            history["val_acc"].append(val_acc)
            progress = (epoch + 1) / cfg["epochs"]
            repo.update_job(job_id, current_epoch=epoch + 1, progress=progress, train_loss=train_loss, train_acc=train_acc, val_loss=val_loss, val_acc=val_acc)
            _log(job_id, f"epoch {epoch+1}/{cfg['epochs']} train_loss={train_loss:.4f} train_acc={train_acc:.4f} val_loss={val_loss:.4f} val_acc={val_acc:.4f} elapsed={elapsed:.1f}s")
            if val_acc > best_acc:
                best_acc = val_acc
                _atomic_save({"model_state_dict": model.state_dict(), "config": cfg, "history": history}, settings.artifact_root / "app" / job_id / "best.pt")
            if event.is_set():
                raise _Cancelled()

        artifact_dir = Path(job["artifact_dir"])
        (artifact_dir / "history.json").write_text(json.dumps(history, indent=2))
        (artifact_dir / "metrics.json").write_text(json.dumps({"best_val_acc": best_acc, "history": history, "duration_seconds": round(time.perf_counter() - started, 2)}, indent=2))
        (artifact_dir / "model.json").write_text(json.dumps({"job_id": job_id, "model_id": job["model_id"], "dataset_id": job["dataset_id"], "architecture": MODEL_SPECS[job["model_id"]]["architecture"], "config": cfg, "best_val_acc": best_acc, "checkpoint": "best.pt", "status": "SUCCEEDED"}, indent=2))
        repo.mark_finished(job_id, "SUCCEEDED", checkpoint_path=str(artifact_dir / "best.pt"))
        _log(job_id, f"Training succeeded; best val_acc={best_acc:.4f}")
    except _Cancelled:
        repo.mark_finished(job_id, "CANCELLED", error="Cancelled by user")
        _log(job_id, "Training cancelled")
    except Exception as exc:  # noqa: BLE001
        repo.mark_finished(job_id, "FAILED", error=str(exc)[:800])
        _log(job_id, f"Training failed: {exc}")
    finally:
        with _lock:
            _cancel_events.pop(job_id, None)


class _Cancelled(Exception):
    pass


def _atomic_save(payload: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    torch.save(payload, tmp)
    tmp.replace(path)
