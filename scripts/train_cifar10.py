"""Train CIFAR-10 CNN on CPU."""
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

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.datasets import load_dataset, make_dataloader, split_dataset
from src.models import CifarCNN
from src.training import Trainer
from src.utils.device import get_device


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/cifar10.json")
    args = parser.parse_args()

    with open(ROOT / args.config) as f:
        cfg = json.load(f)

    set_seed(cfg["seed"])
    device = get_device()
    print(f"Device: {device}")

    train_full = load_dataset(cfg["dataset"], train=True, download=True)
    test_set = load_dataset(cfg["dataset"], train=False, download=True)
    train_set, val_set = split_dataset(train_full, val_fraction=cfg["val_fraction"], seed=cfg["seed"])

    train_loader = make_dataloader(train_set, batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
    val_loader = make_dataloader(val_set, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    model = CifarCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg["learning_rate"], weight_decay=cfg["weight_decay"])

    scheduler = None
    if cfg.get("scheduler") == "cosine":
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg["epochs"])

    trainer = Trainer(model, train_loader, val_loader, criterion, optimizer, device, checkpoint_dir=str(ROOT / "artifacts"))
    best_val_acc = -1.0
    for epoch in range(cfg["epochs"]):
        t0 = time.perf_counter()
        train_loss, train_acc = trainer.train_epoch()
        val_loss, val_acc = trainer.validate()
        if scheduler:
            scheduler.step()
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
