"""Transfer learning utilities.

Provides helper functions to adapt pretrained torchvision models
(e.g. ResNet18) for custom classification tasks by replacing the
final classification head and optionally freezing backbone layers.
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torchvision import models


def get_pretrained_resnet18(
    num_classes: int = 10,
    freeze_backbone: bool = False,
    weights: str = "DEFAULT",
) -> nn.Module:
    """Load a pretrained ResNet18 and replace its classification head.

    Args:
        num_classes: Number of output classes for the new head.
        freeze_backbone: If True, freeze all backbone parameters so only
            the new head is trained.
        weights: Pretrained weights string (e.g. "DEFAULT", "IMAGENET1K_V1").

    Returns:
        A ResNet18 model with a modified final fully-connected layer.
    """
    model = models.resnet18(weights=weights)

    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Replace the final FC layer
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)

    return model


def count_trainable_parameters(model: nn.Module) -> int:
    """Return the number of trainable parameters in a model."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
