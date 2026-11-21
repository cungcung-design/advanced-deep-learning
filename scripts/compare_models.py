"""Consolidate CIFAR-10 model comparison (no retraining)."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.models import CifarCNN, get_pretrained_resnet18

DEVICE = torch.device("cpu")

MODELS = {
    "cifar_cnn": {
        "checkpoint": "artifacts/cifar10_improved.pt",
        "evaluation": "artifacts/cifar10_improved_evaluation.json",
        "image_size": 32,
        "builder": lambda: CifarCNN(),
    },
    "resnet18_feature_extraction": {
        "checkpoint": "artifacts/resnet18_feature_extractor.pt",
        "evaluation": "artifacts/resnet18_feature_extractor_evaluation.json",
        "image_size": 224,
        "builder": lambda: get_pretrained_resnet18(num_classes=10, freeze_backbone=False),
    },
    "resnet18_finetuned": {
        "checkpoint": "artifacts/resnet18_finetuned.pt",
        "evaluation": "artifacts/resnet18_finetuned_evaluation.json",
        "image_size": 128,
        "builder": lambda: get_pretrained_resnet18(num_classes=10, freeze_backbone=False),
    },
}


def measure_latency(model: torch.nn.Module, image_size: int, runs: int = 10) -> float:
    model.eval()
    x = torch.randn(1, 3, image_size, image_size)
    with torch.inference_mode():
        for _ in range(2):
            model(x)
        start = time.perf_counter()
        for _ in range(runs):
            model(x)
    return (time.perf_counter() - start) / runs


def main() -> None:
    torch.set_num_threads(8)
    report = {}
    for name, spec in MODELS.items():
        ckpt_path = ROOT / spec["checkpoint"]
        eval_path = ROOT / spec["evaluation"]
        results = json.loads(eval_path.read_text())
        model = spec["builder"]()
        ckpt = torch.load(ckpt_path, map_location=DEVICE)
        model.load_state_dict(ckpt["model_state_dict"])
        model.to(DEVICE)
        params = sum(p.numel() for p in model.parameters())
        report[name] = {
            "checkpoint": str(ckpt_path),
            "checkpoint_size_bytes": ckpt_path.stat().st_size,
            "parameters": params,
            "image_size": spec["image_size"],
            "accuracy": results["accuracy"],
            "macro_precision": results["per_class"]["macro"]["precision"],
            "macro_recall": results["per_class"]["macro"]["recall"],
            "macro_f1": results["per_class"]["macro"]["f1"],
            "per_class": {k: v for k, v in results["per_class"].items() if k != "macro"},
            "confusion_matrix": results["confusion_matrix"],
            "inference_latency_ms": measure_latency(model, spec["image_size"]) * 1000,
        }

    out = ROOT / "artifacts/cifar10_model_comparison.json"
    out.write_text(json.dumps(report, indent=2))
    for name, r in report.items():
        print(f"{name:32s} acc={r['accuracy']:.4f} f1={r['macro_f1']:.4f} params={r['parameters']:,} size={r['checkpoint_size_bytes']/1e6:.1f}MB latency={r['inference_latency_ms']:.1f}ms")
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
