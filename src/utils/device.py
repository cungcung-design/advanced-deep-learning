"""Device selection utilities for CPU/CUDA execution.

Prefers CUDA when available, falls back to CPU otherwise.
"""

from __future__ import annotations

import torch


def get_device() -> torch.device:
    """Return the best available torch device.

    Returns a CUDA device if an NVIDIA GPU is available, otherwise CPU.
    """
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def get_device_name() -> str:
    """Return a human-readable name for the selected device."""
    device = get_device()
    if device.type == "cuda":
        return f"cuda:{device.index} ({torch.cuda.get_device_name(device.index)})"
    return "cpu"


def to_device(obj, device: torch.device | None = None):
    """Move a tensor or module to the selected device.

    If no device is given, the best available device is used.
    """
    if device is None:
        device = get_device()
    return obj.to(device)
