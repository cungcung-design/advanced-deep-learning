"""Train a small MNIST classification model on CPU."""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import torch
import torch.nn as nn

from src.datasets import load_dataset, make_dataloader, split_dataset
from src.models import MNISTCNN
from src.training import Trainer
from src.utils.device import get_device


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/mnist_cpu.json")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = json.load(f)

    set_seed(cfg["seed"])
    device = get_device()
    print(f"Device: {device}")

    train_full = load_dataset(cfg["dataset"], train=True, download=True)
    test_set = load_dataset(cfg["dataset"], train=False, download=True)
    train_set, val_set = split_dataset(train_full, val_fraction=cfg["val_fraction"], seed=cfg["seed"])

    train_loader = make_dataloader(train_set, batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
    val_loader = make_dataloader(val_set, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    model = MNISTCNN(num_classes=10).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg["learning_rate"])

    trainer = Trainer(model, train_loader, val_loader, criterion, optimizer, device, checkpoint_dir="artifacts")
    history = trainer.fit(epochs=cfg["epochs"])

    ckpt = Path(cfg["checkpoint_path"])
    ckpt.parent.mkdir(parents=True, exist_ok=True)
    trainer.save_checkpoint(str(ckpt))
    print(f"Checkpoint saved: {ckpt}")

    # Test evaluation
    from src.training import evaluate, print_evaluation
    test_loader = make_dataloader(test_set, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])
    results = evaluate(model, test_loader, device)
    print_evaluation(results)


if __name__ == "__main__":
    main()
