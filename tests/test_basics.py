"""Basic tests for PyTorch foundations (Week 9).

Covers:
- Tensor creation and operations
- Autograd / computational graphs
- Small neural network forward + backward pass
- CPU execution
"""

from __future__ import annotations

import pytest
import torch
import torch.nn as nn

from src.models.cnn import MNISTCNN, SimpleCNN
from src.utils.device import get_device, get_device_name


def test_device_selection():
    """Device falls back to CPU when no GPU is available."""
    device = get_device()
    assert device.type in ("cpu", "cuda")
    name = get_device_name()
    assert isinstance(name, str) and len(name) > 0


def test_tensor_creation():
    """Basic tensor creation works."""
    x = torch.zeros(3, 4)
    assert x.shape == (3, 4)
    assert x.dtype == torch.float32

    y = torch.ones(2, 3)
    assert y.shape == (2, 3)

    z = torch.randn(4, 4)
    assert z.shape == (4, 4)


def test_tensor_operations():
    """Element-wise and reduction operations work."""
    a = torch.tensor([1.0, 2.0, 3.0])
    b = torch.tensor([4.0, 5.0, 6.0])

    c = a + b
    assert torch.allclose(c, torch.tensor([5.0, 7.0, 9.0]))

    d = a * b
    assert torch.allclose(d, torch.tensor([4.0, 10.0, 18.0]))

    s = a.sum()
    assert s.item() == 6.0

    m = a.mean()
    assert m.item() == 2.0


def test_autograd():
    """Autograd computes gradients through a computational graph."""
    x = torch.tensor([2.0, 3.0], requires_grad=True)
    y = x**2 + 3 * x + 1
    loss = y.sum()
    loss.backward()

    # dy/dx = 2x + 3 => at x=2: 7, at x=3: 9
    expected_grad = torch.tensor([7.0, 9.0])
    assert x.grad is not None
    assert torch.allclose(x.grad, expected_grad)


def test_autograd_second_order():
    """Gradients can flow through multiple operations."""
    w = torch.tensor([1.0, 2.0], requires_grad=True)
    b = torch.tensor([0.5], requires_grad=True)
    x = torch.tensor([3.0, 4.0])

    out = (w * x + b).sum()
    out.backward()

    # d/dw = x => [3.0, 4.0]
    # d/db = sum over broadcast = 2.0 (b shape [1] broadcasts over 2 elements)
    assert torch.allclose(w.grad, x)
    assert b.grad.item() == 2.0


def test_cnn_forward_pass():
    """A CNN can perform a forward pass on CPU."""
    device = get_device()
    model = SimpleCNN(num_classes=10, in_channels=3).to(device)
    model.eval()

    batch = torch.randn(4, 3, 32, 32).to(device)
    with torch.no_grad():
        output = model(batch)

    assert output.shape == (4, 10)


def test_cnn_backward_pass():
    """A CNN can perform a backward pass on CPU."""
    device = get_device()
    model = SimpleCNN(num_classes=10, in_channels=3).to(device)
    criterion = nn.CrossEntropyLoss()

    batch = torch.randn(2, 3, 32, 32).to(device)
    targets = torch.tensor([0, 1], device=device)

    output = model(batch)
    loss = criterion(output, targets)
    loss.backward()

    # At least one parameter should have a non-None gradient
    has_grad = any(
        p.grad is not None for p in model.parameters()
    )
    assert has_grad, "No gradients computed during backward pass"


def test_mnist_cnn_forward_pass():
    """MNIST CNN works with single-channel input."""
    device = get_device()
    model = MNISTCNN(num_classes=10).to(device)
    model.eval()

    batch = torch.randn(4, 1, 28, 28).to(device)
    with torch.no_grad():
        output = model(batch)

    assert output.shape == (4, 10)


def test_tensor_device_placement():
    """Tensors can be moved to the selected device."""
    device = get_device()
    x = torch.tensor([1.0, 2.0, 3.0])
    x_device = x.to(device)
    assert x_device.device.type == device.type
    assert x_device.device.index == (device.index if device.index is not None else (0 if device.type == "cuda" else None))


def test_model_parameters_have_grad_after_backward():
    """All model parameters receive gradients after backward."""
    device = get_device()
    model = SimpleCNN(num_classes=10, in_channels=3).to(device)
    criterion = nn.CrossEntropyLoss()

    batch = torch.randn(2, 3, 32, 32).to(device)
    targets = torch.tensor([0, 1], device=device)

    output = model(batch)
    loss = criterion(output, targets)
    loss.backward()

    for name, param in model.named_parameters():
        assert param.grad is not None, f"Parameter {name} has no gradient"
