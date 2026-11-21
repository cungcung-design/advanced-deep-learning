"""Dataset loading and management utilities.

Supports common vision datasets (MNIST, CIFAR-10, CIFAR-100, ImageFolder)
with train/validation/test splits. Datasets are downloaded automatically
on first use.
"""

from __future__ import annotations

from typing import Optional, Tuple

import torch
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import datasets, transforms


def get_transforms(dataset_name: str, train: bool = True):
    """Return standard preprocessing transforms for a dataset.

    Args:
        dataset_name: One of "mnist", "cifar10", "cifar100".
        train: Whether these transforms are for training (augmentation applied).

    Returns:
        A torchvision.transforms.Compose object.
    """
    if dataset_name == "mnist":
        if train:
            return transforms.Compose(
                [
                    transforms.RandomAffine(degrees=10, translate=(0.1, 0.1)),
                    transforms.ToTensor(),
                    transforms.Normalize((0.1307,), (0.3081,)),
                ]
            )
        return transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize((0.1307,), (0.3081,)),
            ]
        )

    if dataset_name in ("cifar10", "cifar100"):
        if train:
            return transforms.Compose(
                [
                    transforms.RandomCrop(32, padding=4),
                    transforms.RandomHorizontalFlip(),
                    transforms.ToTensor(),
                    transforms.Normalize(
                        (0.4914, 0.4822, 0.4465),
                        (0.2023, 0.1994, 0.2010),
                    ),
                ]
            )
        return transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize(
                    (0.4914, 0.4822, 0.4465),
                    (0.2023, 0.1994, 0.2010),
                ),
            ]
        )

    raise ValueError(f"Unknown dataset: {dataset_name}")


def load_dataset(
    dataset_name: str,
    root: str = "data/raw",
    train: bool = True,
    download: bool = True,
) -> Dataset:
    """Load a torchvision dataset by name.

    Args:
        dataset_name: One of "mnist", "cifar10", "cifar100".
        root: Root directory for dataset storage.
        train: Whether to load the training split.
        download: Whether to download the dataset if missing.

    Returns:
        A torch.utils.data.Dataset instance.
    """
    transform = get_transforms(dataset_name, train=train)

    if dataset_name == "mnist":
        return datasets.MNIST(
            root=root, train=train, transform=transform, download=download
        )
    if dataset_name == "cifar10":
        return datasets.CIFAR10(
            root=root, train=train, transform=transform, download=download
        )
    if dataset_name == "cifar100":
        return datasets.CIFAR100(
            root=root, train=train, transform=transform, download=download
        )

    raise ValueError(f"Unknown dataset: {dataset_name}")


def split_dataset(
    dataset: Dataset,
    val_fraction: float = 0.1,
    seed: int = 42,
) -> Tuple[Dataset, Dataset]:
    """Split a dataset into train and validation subsets.

    Args:
        dataset: The full dataset to split.
        val_fraction: Fraction of data to use for validation (0.0 to 1.0).
        seed: Random seed for reproducibility.

    Returns:
        A tuple of (train_subset, val_subset).
    """
    n_total = len(dataset)
    n_val = int(n_total * val_fraction)
    n_train = n_total - n_val

    generator = torch.Generator().manual_seed(seed)
    return random_split(
        dataset,
        [n_train, n_val],
        generator=generator,
    )


def make_dataloader(
    dataset: Dataset,
    batch_size: int = 32,
    shuffle: bool = True,
    num_workers: int = 0,
    pin_memory: bool = False,
) -> DataLoader:
    """Create a DataLoader for a dataset.

    Args:
        dataset: The dataset to wrap.
        batch_size: Number of samples per batch.
        shuffle: Whether to shuffle the data each epoch.
        num_workers: Number of subprocesses for data loading (0 = main process).
        pin_memory: Whether to copy tensors into pinned memory (GPU speedup).

    Returns:
        A torch.utils.data.DataLoader instance.
    """
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
    )
