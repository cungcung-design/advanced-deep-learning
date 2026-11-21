"""Classification metrics for real evaluation runs.

Metrics are computed from model predictions and ground-truth targets only.
Historical evaluation JSON files are never used as a substitute.
"""
from __future__ import annotations

from typing import Sequence


def _to_list(values) -> list[int]:
    if hasattr(values, "tolist"):
        values = values.tolist()
    return [int(value) for value in values]


def compute_classification_metrics(
    predictions: Sequence[int],
    targets: Sequence[int],
    class_names: Sequence[str],
) -> dict:
    """Return accuracy, confusion matrix, per-class and macro metrics.

    Rows of the confusion matrix are true labels and columns are predictions.
    Zero-support classes produce zero precision, recall, and F1 instead of a
    division error.
    """
    preds = _to_list(predictions)
    truth = _to_list(targets)
    if len(preds) != len(truth):
        raise ValueError("predictions and targets must have the same length")

    names = [str(name) for name in class_names]
    n_classes = len(names)
    if n_classes == 0:
        raise ValueError("class_names must not be empty")

    matrix = [[0] * n_classes for _ in range(n_classes)]
    correct = 0
    for pred, target in zip(preds, truth):
        if not 0 <= target < n_classes or not 0 <= pred < n_classes:
            raise ValueError("prediction or target label is outside the class range")
        matrix[target][pred] += 1
        if pred == target:
            correct += 1

    total = len(truth)
    accuracy = correct / total if total else 0.0

    per_class: dict[str, dict] = {}
    precisions: list[float] = []
    recalls: list[float] = []
    f1s: list[float] = []
    supports: list[int] = []

    for index, name in enumerate(names):
        true_positive = matrix[index][index]
        predicted_positive = sum(matrix[row][index] for row in range(n_classes))
        support = sum(matrix[index])
        false_positive = predicted_positive - true_positive
        false_negative = support - true_positive

        precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) else 0.0
        recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

        per_class[name] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support,
        }
        precisions.append(precision)
        recalls.append(recall)
        f1s.append(f1)
        supports.append(support)

    macro_precision = sum(precisions) / n_classes
    macro_recall = sum(recalls) / n_classes
    macro_f1 = sum(f1s) / n_classes

    return {
        "accuracy": accuracy,
        "sample_count": total,
        "classes": names,
        "confusion_matrix": matrix,
        "per_class": per_class,
        "macro": {
            "precision": macro_precision,
            "recall": macro_recall,
            "f1": macro_f1,
        },
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "supports": supports,
    }
