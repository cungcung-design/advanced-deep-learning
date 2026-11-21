"""Data preprocessing and augmentation utilities.

Provides composable transforms for vision datasets and helper functions
for normalizing/denormalizing tensors for visualization.
"""

from __future__ import annotations

from typing import Optional

import torch
from torchvision import transforms


def get_train_transforms(
    dataset_name: str,
    resize: Optional[int] = None,
) -> transforms.Compose:
    """Return training transforms with light augmentation.

    Args:
        dataset_name: One of "mnist", "cifar10", "cifar100", "imagenet".
        resize: Optional resize dimension before cropping.

    Returns:
        A torchvision.transforms.Compose object.
    """
    transform_list = []

    if resize is not None:
        transform_list.append(transforms.Resize(resize))

    if dataset_name == "mnist":
        transform_list.extend(
            [
                transforms.RandomAffine(degrees=10, translate=(0.1, 0.1)),
                transforms.ToTensor(),
                transforms.Normalize((0.1307,), (0.3081,)),
            ]
        )
    elif dataset_name in ("cifar10", "cifar100"):
        transform_list.extend(
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
    elif dataset_name == "imagenet":
        transform_list.extend(
            [
                transforms.RandomResizedCrop(224),
                transforms.RandomHorizontalFlip(),
                transforms.ToTensor(),
                transforms.Normalize(
                    (0.485, 0.456, 0.406),
                    (0.229, 0.224, 0.225),
                ),
            ]
        )
    else:
        raise ValueError(f"Unknown dataset: {dataset_name}")

    return transforms.Compose(transform_list)


def get_eval_transforms(
    dataset_name: str,
    resize: Optional[int] = None,
) -> transforms.Compose:
    """Return evaluation transforms (no augmentation).

    Args:
        dataset_name: One of "mnist", "cifar10", "cifar100", "imagenet".
        resize: Optional resize dimension.

    Returns:
        A torchvision.transforms.Compose object.
    """
    transform_list = []

    if dataset_name == "imagenet" and resize is not None:
        transform_list.append(transforms.Resize(256))
        transform_list.append(transforms.CenterCrop(224))
    elif resize is not None:
        transform_list.append(transforms.Resize(resize))
        transform_list.append(transforms.CenterCrop(resize))

    if dataset_name == "mnist":
        transform_list.extend(
            [
                transforms.ToTensor(),
                transforms.Normalize((0.1307,), (0.3081,)),
            ]
        )
    elif dataset_name in ("cifar10", "cifar100"):
        transform_list.extend(
            [
                transforms.ToTensor(),
                transforms.Normalize(
                    (0.4914, 0.4822, 0.4465),
                    (0.2023, 0.1994, 0.2010),
                ),
            ]
        )
    elif dataset_name == "imagenet":
        transform_list.extend(
            [
                transforms.ToTensor(),
                transforms.Normalize(
                    (0.485, 0.456, 0.406),
                    (0.229, 0.224, 0.225),
                ),
            ]
        )
    else:
        raise ValueError(f"Unknown dataset: {dataset_name}")

    return transforms.Compose(transform_list)


def denormalize(tensor: torch.Tensor, mean, std) -> torch.Tensor:
    """Undo normalization on a tensor for visualization.

    Args:
        tensor: A normalized image tensor (C, H, W) or (B, C, H, W).
        mean: Mean used during normalization.
        std: Standard deviation used during normalization.

    Returns:
        A denormalized tensor in the same shape.
    """
    mean_t = torch.tensor(mean, device=tensor.device).view(-1, 1, 1)
    std_t = torch.tensor(std, device=tensor.device).view(-1, 1, 1)
    if tensor.dim() == 4:
        mean_t = mean_t.unsqueeze(0)
        std_t = std_t.unsqueeze(0)
    return tensor * std_t + mean_t
