"""Environment verification script for Advanced Deep Learning (Week 9).

Run with:  python verify_env.py

Checks:
- Python version
- PyTorch import and version
- Torchvision import and version
- NumPy import and version
- CPU/GPU/CUDA status
- Tensor creation and operations
- Autograd (gradient computation)
- Small neural network forward + backward pass
"""

from __future__ import annotations

import sys

import numpy as np
import torch
import torch.nn as nn


def check_python() -> bool:
    print(f"Python version: {sys.version}")
    return True


def check_torch() -> bool:
    print(f"PyTorch version: {torch.__version__}")
    print(f"PyTorch CPU build: {'+cpu' in torch.__version__}")
    return True


def check_torchvision() -> bool:
    try:
        import torchvision
        print(f"Torchvision version: {torchvision.__version__}")
        return True
    except ImportError:
        print("Torchvision: NOT INSTALLED (run: pip install -r requirements.txt)")
        return False


def check_numpy() -> bool:
    print(f"NumPy version: {np.__version__}")
    return True


def check_device() -> bool:
    cuda_available = torch.cuda.is_available()
    device = torch.device("cuda" if cuda_available else "cpu")
    print(f"CUDA available: {cuda_available}")
    print(f"Selected device: {device}")
    if cuda_available:
        print(f"CUDA device: {torch.cuda.get_device_name(0)}")
    else:
        print("Running on CPU (expected for Intel i7-1265U without NVIDIA GPU)")
    return True


def check_tensor_ops() -> bool:
    x = torch.zeros(3, 4)
    y = torch.ones(3, 4)
    z = x + y
    assert z.shape == (3, 4)
    assert torch.allclose(z, torch.ones(3, 4))
    print("Tensor creation and operations: OK")
    return True


def check_autograd() -> bool:
    x = torch.tensor([2.0, 3.0], requires_grad=True)
    y = x**2 + 3 * x + 1
    loss = y.sum()
    loss.backward()

    expected = torch.tensor([7.0, 9.0])
    assert x.grad is not None
    assert torch.allclose(x.grad, expected)
    print("Autograd: OK (gradients computed correctly)")
    return True


def check_nn_forward_backward() -> bool:
    model = nn.Sequential(
        nn.Linear(10, 20),
        nn.ReLU(),
        nn.Linear(20, 5),
    )
    criterion = nn.MSELoss()

    x = torch.randn(4, 10)
    target = torch.randn(4, 5)

    output = model(x)
    assert output.shape == (4, 5)

    loss = criterion(output, target)
    loss.backward()

    has_grad = any(p.grad is not None for p in model.parameters())
    assert has_grad
    print("NN forward + backward pass: OK")
    return True


def main() -> None:
    print("=" * 60)
    print("Advanced Deep Learning - Environment Verification")
    print("=" * 60)

    checks = [
        ("Python", check_python),
        ("PyTorch", check_torch),
        ("Torchvision", check_torchvision),
        ("NumPy", check_numpy),
        ("Device (CPU/CUDA)", check_device),
        ("Tensor operations", check_tensor_ops),
        ("Autograd", check_autograd),
        ("NN forward/backward", check_nn_forward_backward),
    ]

    passed = 0
    failed = 0

    for name, check in checks:
        try:
            ok = check()
            if ok:
                passed += 1
            else:
                failed += 1
                print(f"  [{name}] FAILED")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  [{name}] ERROR: {exc}")

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed out of {len(checks)}")

    if failed == 0:
        print("Environment is ready for Week 9 (PyTorch foundations).")
    else:
        print("Some checks failed. Please install missing dependencies.")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
