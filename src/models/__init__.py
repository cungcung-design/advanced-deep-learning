"""Model architectures: CNNs and transfer learning."""

from .cifar_cnn import CifarCNN
from .cnn import SimpleCNN, MNISTCNN
from .transfer import get_pretrained_resnet18, count_trainable_parameters

__all__ = [
    "CifarCNN",
    "SimpleCNN",
    "MNISTCNN",
    "get_pretrained_resnet18",
    "count_trainable_parameters",
]
