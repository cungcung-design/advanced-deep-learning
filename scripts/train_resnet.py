"""Train ResNet18 transfer learning experiments on CPU."""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torchvision import datasets, transforms

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.models import get_pretrained_resnet18
from src.training import Trainer
from src.utils.device import get_device


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def transforms_for(mode: str, train: bool, image_size: int = 224):
    if train:
        return transforms.Compose([
            transforms.RandomResizedCrop(image_size),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
        ])
    return transforms.Compose([
        transforms.Resize(image_size),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()

    with open(ROOT / args.config) as f:
        cfg = json.load(f)

    set_seed(cfg["seed"])
    if cfg.get("num_threads"):
        torch.set_num_threads(cfg["num_threads"])
    device = get_device()
    print(f"Device: {device}")

    train_transform = transforms_for(cfg["mode"], True, cfg.get("image_size", 224))
    eval_transform = transforms_for(cfg["mode"], False, cfg.get("image_size", 224))

    train_full = datasets.CIFAR10(root=str(ROOT / "data/raw"), train=True, transform=train_transform, download=True)
    test_set = datasets.CIFAR10(root=str(ROOT / "data/raw"), train=False, transform=eval_transform, download=True)

    # validation split
    n_val = int(len(train_full) * cfg["val_fraction"])
    n_train = len(train_full) - n_val
    generator = torch.Generator().manual_seed(cfg["seed"])
    train_set, val_set = torch.utils.data.random_split(train_full, [n_train, n_val], generator=generator)
    # val needs eval transform; recreate subset with eval transform dataset
    val_full = datasets.CIFAR10(root=str(ROOT / "data/raw"), train=True, transform=eval_transform, download=False)
    val_set = torch.utils.data.Subset(val_full, val_set.indices)

    from torch.utils.data import DataLoader
    train_loader = DataLoader(train_set, batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
    val_loader = DataLoader(val_set, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    if cfg["mode"] == "feature_extraction":
        model = get_pretrained_resnet18(num_classes=10, freeze_backbone=True).to(device)
    else:
        model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False).to(device)
        for name, param in model.named_parameters():
            if not (name.startswith("layer4") or name.startswith("fc")):
                param.requires_grad = False

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=cfg["learning_rate"], weight_decay=cfg["weight_decay"])

    trainer = Trainer(model, train_loader, val_loader, criterion, optimizer, device, checkpoint_dir=str(ROOT / "artifacts"))
    best_val_acc = -1.0
    for epoch in range(cfg["epochs"]):
        t0 = time.perf_counter()
        train_loss, train_acc = trainer.train_epoch()
        val_loss, val_acc = trainer.validate()
        elapsed = time.perf_counter() - t0
        trainer.history["train_loss"].append(train_loss)
        trainer.history["train_acc"].append(train_acc)
        trainer.history["val_loss"].append(val_loss)
        trainer.history["val_acc"].append(val_acc)
        print(f"Epoch {epoch+1}/{cfg['epochs']} | train_loss {train_loss:.4f} train_acc {train_acc:.4f} | val_loss {val_loss:.4f} val_acc {val_acc:.4f} | time {elapsed:.1f}s")
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            trainer.save_checkpoint(str(ROOT / cfg["checkpoint_path"]))
            print(f"Saved best checkpoint (val_acc={val_acc:.4f})")
    print(f"Best val_acc: {best_val_acc:.4f}")


if __name__ == "__main__":
    main()

