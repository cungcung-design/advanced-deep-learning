"""Evaluation utilities.

Contains functions to evaluate a trained model on a test dataset
and compute accuracy, per-class metrics, and confusion statistics.
"""

from __future__ import annotations

from typing import Optional

import torch
import torch.nn as nn
from torch.utils.data import DataLoader


@torch.no_grad()
def evaluate(
    model: nn.Module,
    test_loader: DataLoader,
    device: torch.device,
    class_names: Optional[list[str]] = None,
) -> dict:
    """Evaluate a model on a test dataset.

    Args:
        model: The trained model.
        test_loader: DataLoader for test data.
        device: Torch device to run on.
        class_names: Optional list of class names for per-class reporting.

    Returns:
        A dictionary with overall accuracy, loss, and per-class metrics.
    """
    model.eval()
    criterion = nn.CrossEntropyLoss()

    running_loss = 0.0
    correct = 0
    total = 0

    n_classes = len(class_names) if class_names else 10
    class_correct = torch.zeros(n_classes)
    class_total = torch.zeros(n_classes)

    for inputs, targets in test_loader:
        inputs = inputs.to(device)
        targets = targets.to(device)

        outputs = model(inputs)
        loss = criterion(outputs, targets)

        running_loss += loss.item() * inputs.size(0)
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()

        for i in range(targets.size(0)):
            label = targets[i].item()
            class_correct[label] += predicted[i].eq(label).item()
            class_total[label] += 1

    overall_acc = correct / total
    overall_loss = running_loss / total

    per_class = {}
    if class_names:
        for i, name in enumerate(class_names):
            if class_total[i] > 0:
                per_class[name] = {
                    "accuracy": class_correct[i].item() / class_total[i],
                    "correct": int(class_correct[i].item()),
                    "total": int(class_total[i].item()),
                }

    return {
        "loss": overall_loss,
        "accuracy": overall_acc,
        "correct": correct,
        "total": total,
        "per_class": per_class,
    }


def print_evaluation(results: dict) -> None:
    """Print evaluation results in a readable format."""
    print(f"Test loss:  {results['loss']:.4f}")
    print(f"Test acc:   {results['accuracy']:.4f} "
          f"({results['correct']}/{results['total']})")

    if results["per_class"]:
        print("\nPer-class accuracy:")
        for name, metrics in results["per_class"].items():
            print(
                f"  {name:12s}: {metrics['accuracy']:.4f} "
                f"({metrics['correct']}/{metrics['total']})"
            )
