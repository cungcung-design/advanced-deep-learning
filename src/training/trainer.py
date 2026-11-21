"""Training loop utilities.

Contains a Trainer class that handles the standard train/validate loop
with loss tracking, accuracy reporting, and checkpoint saving.
"""

from __future__ import annotations

import os
from typing import Callable, Dict, Optional

import torch
import torch.nn as nn
from torch.utils.data import DataLoader


class Trainer:
    """Standard supervised training loop.

    Args:
        model: The neural network model to train.
        train_loader: DataLoader for training data.
        val_loader: DataLoader for validation data.
        criterion: Loss function (e.g. nn.CrossEntropyLoss).
        optimizer: Optimizer (e.g. torch.optim.Adam).
        device: Torch device to run on.
        checkpoint_dir: Directory to save checkpoints (default: "checkpoints").
    """

    def __init__(
        self,
        model: nn.Module,
        train_loader: DataLoader,
        val_loader: DataLoader,
        criterion: nn.Module,
        optimizer: torch.optim.Optimizer,
        device: torch.device,
        checkpoint_dir: str = "checkpoints",
    ) -> None:
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.criterion = criterion
        self.optimizer = optimizer
        self.device = device
        self.checkpoint_dir = checkpoint_dir

        self.history: Dict[str, list] = {
            "train_loss": [],
            "train_acc": [],
            "val_loss": [],
            "val_acc": [],
        }

        os.makedirs(checkpoint_dir, exist_ok=True)

    def train_epoch(
        self,
        on_batch_end: Optional[Callable[[int, int], None]] = None,
    ) -> tuple[float, float]:
        """Run one training epoch.

        Args:
            on_batch_end: Optional callback invoked after each batch with
                ``(batch_index, total_batches)``. Used by the background
                training runner to report progress and check cancellation.

        Returns:
            A tuple of (average_loss, accuracy).
        """
        self.model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        try:
            total_batches = len(self.train_loader)
        except TypeError:
            total_batches = 0

        for batch_index, (inputs, targets) in enumerate(self.train_loader, start=1):
            inputs = inputs.to(self.device)
            targets = targets.to(self.device)

            self.optimizer.zero_grad()
            outputs = self.model(inputs)
            loss = self.criterion(outputs, targets)
            loss.backward()
            self.optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)
            total += targets.size(0)
            correct += predicted.eq(targets).sum().item()

            if on_batch_end is not None:
                on_batch_end(batch_index, total_batches)

        epoch_loss = running_loss / total
        epoch_acc = correct / total
        return epoch_loss, epoch_acc

    @torch.no_grad()
    def validate(
        self,
        on_batch_end: Optional[Callable[[int, int], None]] = None,
    ) -> tuple[float, float]:
        """Run validation.

        Args:
            on_batch_end: Optional callback invoked after each validation
                batch with ``(batch_index, total_batches)``.

        Returns:
            A tuple of (average_loss, accuracy).
        """
        self.model.eval()
        running_loss = 0.0
        correct = 0
        total = 0

        try:
            total_batches = len(self.val_loader)
        except TypeError:
            total_batches = 0

        for batch_index, (inputs, targets) in enumerate(self.val_loader, start=1):
            inputs = inputs.to(self.device)
            targets = targets.to(self.device)

            outputs = self.model(inputs)
            loss = self.criterion(outputs, targets)

            running_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)
            total += targets.size(0)
            correct += predicted.eq(targets).sum().item()

            if on_batch_end is not None:
                on_batch_end(batch_index, total_batches)

        epoch_loss = running_loss / total
        epoch_acc = correct / total
        return epoch_loss, epoch_acc

    def fit(self, epochs: int = 10) -> Dict[str, list]:
        """Train for a number of epochs.

        Args:
            epochs: Number of epochs to train.

        Returns:
            The training history dictionary.
        """
        for epoch in range(epochs):
            train_loss, train_acc = self.train_epoch()
            val_loss, val_acc = self.validate()

            self.history["train_loss"].append(train_loss)
            self.history["train_acc"].append(train_acc)
            self.history["val_loss"].append(val_loss)
            self.history["val_acc"].append(val_acc)

            print(
                f"Epoch {epoch + 1:3d}/{epochs} | "
                f"train_loss: {train_loss:.4f} train_acc: {train_acc:.4f} | "
                f"val_loss: {val_loss:.4f} val_acc: {val_acc:.4f}"
            )

        return self.history

    def save_checkpoint(self, path: str) -> None:
        """Save model and optimizer state to a checkpoint file."""
        torch.save(
            {
                "model_state_dict": self.model.state_dict(),
                "optimizer_state_dict": self.optimizer.state_dict(),
                "history": self.history,
            },
            path,
        )

    def load_checkpoint(self, path: str) -> None:
        """Load model and optimizer state from a checkpoint file."""
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.history = checkpoint.get("history", self.history)
