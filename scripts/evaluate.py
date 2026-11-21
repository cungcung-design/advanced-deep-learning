"""Evaluate trained models (CifarCNN or ResNet18)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.evaluation.metrics import confusion_matrix, per_class_metrics, save_json
from src.models import CifarCNN, get_pretrained_resnet18
from src.utils.device import get_device

CLASS_NAMES = ["airplane", "automobile", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"]


def build_model(model_name: str):
    if model_name == "cifar_cnn":
        return CifarCNN()
    if model_name == "resnet18":
        return get_pretrained_resnet18(num_classes=10, freeze_backbone=False)
    raise ValueError(f"Unknown model: {model_name}")


def transforms_for(model_name: str, train: bool, image_size: int = 224):
    if model_name == "cifar_cnn":
        if train:
            return transforms.Compose([])
        return transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)),
        ])
    # resnet
    if train:
        return transforms.Compose([])
    return transforms.Compose([
        transforms.Resize(image_size),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/cifar10.json")
    parser.add_argument("--checkpoint", default=None)
    args = parser.parse_args()

    with open(ROOT / args.config) as f:
        cfg = json.load(f)

    model_name = cfg.get("model", "cifar_cnn")
    ckpt_path = ROOT / (args.checkpoint or cfg["checkpoint_path"])
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    device = get_device()
    model = build_model(model_name).to(device)
    checkpoint = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    eval_transform = transforms_for(model_name, False, cfg.get("image_size", 224))
    test_set = datasets.CIFAR10(root=str(ROOT / "data/raw"), train=False, transform=eval_transform, download=True)
    test_loader = DataLoader(test_set, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    all_preds, all_targets = [], []
    with torch.inference_mode():
        for inputs, targets in test_loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            _, predicted = outputs.max(1)
            all_preds.append(predicted.cpu())
            all_targets.append(targets.cpu())

    preds = torch.cat(all_preds)
    targets = torch.cat(all_targets)
    acc = (preds == targets).float().mean().item()
    cm = confusion_matrix(preds, targets, 10)
    metrics = per_class_metrics(cm)
    metrics["accuracy"] = acc

    out_path = ROOT / cfg["evaluation_path"]
    save_json({"accuracy": acc, "confusion_matrix": cm, "per_class": metrics, "model": model_name, "checkpoint": str(ckpt_path)}, out_path)
    print(f"Model: {model_name}")
    print(f"Checkpoint: {ckpt_path}")
    print(f"Test accuracy: {acc:.4f}")
    for i, name in enumerate(CLASS_NAMES):
        m = metrics[str(i)]
        print(f"  {name:12s} precision={m['precision']:.4f} recall={m['recall']:.4f} f1={m['f1']:.4f} support={m['support']}")
    print(f"Macro F1: {metrics['macro']['f1']:.4f}")
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()


