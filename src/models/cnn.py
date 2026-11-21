"""CNN model architectures.

Contains baseline CNN architectures suitable for small image datasets
such as MNIST and CIFAR-10.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class SimpleCNN(nn.Module):
    """A small convolutional neural network.

    Architecture:
        Conv2d(3 -> 32, 3x3) -> ReLU -> MaxPool2d
        Conv2d(32 -> 64, 3x3) -> ReLU -> MaxPool2d
        Conv2d(64 -> 128, 3x3) -> ReLU -> MaxPool2d
        Flatten
        Linear(128 * 4 * 4 -> 256) -> ReLU -> Dropout
        Linear(256 -> num_classes)

    Expects 32x32 input images with 3 channels (e.g. CIFAR-10).
    For MNIST (1 channel), set in_channels=1.
    """

    def __init__(self, num_classes: int = 10, in_channels: int = 3) -> None:
        super().__init__()

        self.features = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.classifier(x)
        return x


class MNISTCNN(nn.Module):
    """A CNN optimized for MNIST (28x28 grayscale images).

    Architecture:
        Conv2d(1 -> 32, 3x3) -> ReLU -> MaxPool2d
        Conv2d(32 -> 64, 3x3) -> ReLU -> MaxPool2d
        Flatten
        Linear(64 * 7 * 7 -> 128) -> ReLU -> Dropout
        Linear(128 -> num_classes)

    For 28x28 MNIST input: two MaxPool2d(2, stride=2) reduce 28->14->7.
    """

    def __init__(self, num_classes: int = 10) -> None:
        super().__init__()

        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 7 * 7, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.classifier(x)
        return x
