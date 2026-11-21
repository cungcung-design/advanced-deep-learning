"""Evaluation metrics for classification."""
from __future__ import annotations

import json
from pathlib import Path
from typing import List

import torch


def confusion_matrix(preds: torch.Tensor, targets: torch.Tensor, num_classes: int) -> List[List[int]]:
    cm = [[0] * num_classes for _ in range(num_classes)]
    for p, t in zip(preds.tolist(), targets.tolist()):
        cm[t][p] += 1
    return cm


def per_class_metrics(cm: List[List[int]]) -> dict:
    n = len(cm)
    metrics = {}
    precisions, recalls, f1s = [], [], []
    for i in range(n):
        tp = cm[i][i]
        fp = sum(cm[r][i] for r in range(n)) - tp
        fn = sum(cm[i]) - tp
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        metrics[str(i)] = {"precision": precision, "recall": recall, "f1": f1, "support": sum(cm[i])}
        precisions.append(precision)
        recalls.append(recall)
        f1s.append(f1)
    metrics["macro"] = {
        "precision": sum(precisions) / n,
        "recall": sum(recalls) / n,
        "f1": sum(f1s) / n,
    }
    return metrics


def save_json(obj: dict, path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
