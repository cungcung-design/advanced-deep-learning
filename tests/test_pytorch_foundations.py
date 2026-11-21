"""Tests for PyTorch foundations milestone."""
from __future__ import annotations

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from src.models.cnn import MNISTCNN, SimpleCNN
from src.training.trainer import Trainer
from src.utils.device import get_device


def test_model_initialization():
    model = MNISTCNN(num_classes=10)
    assert isinstance(model, nn.Module)
    assert len(list(model.parameters())) > 0


def test_forward_pass():
    device = get_device()
    model = MNISTCNN().to(device).eval()
    x = torch.randn(2, 1, 28, 28, device=device)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (2, 10)


def test_output_dimensions():
    device = get_device()
    model = SimpleCNN(num_classes=5, in_channels=3).to(device).eval()
    x = torch.randn(3, 3, 32, 32, device=device)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (3, 5)


def test_loss_calculation():
    device = get_device()
    model = MNISTCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    x = torch.randn(4, 1, 28, 28, device=device)
    y = torch.tensor([0, 1, 2, 3], device=device)
    out = model(x)
    loss = criterion(out, y)
    assert loss.item() >= 0
    assert torch.isfinite(loss)


def test_backward_pass():
    device = get_device()
    model = MNISTCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    x = torch.randn(2, 1, 28, 28, device=device)
    y = torch.tensor([0, 1], device=device)
    out = model(x)
    loss = criterion(out, y)
    loss.backward()
    assert any(p.grad is not None for p in model.parameters())


def test_parameter_updates():
    device = get_device()
    model = MNISTCNN().to(device)
    optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
    criterion = nn.CrossEntropyLoss()
    x = torch.randn(2, 1, 28, 28, device=device)
    y = torch.tensor([0, 1], device=device)

    before = [p.clone() for p in model.parameters()]
    out = model(x)
    loss = criterion(out, y)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    after = list(model.parameters())
    assert any(not torch.allclose(b, a) for b, a in zip(before, after))


def test_dataset_and_dataloader():
    x = torch.randn(20, 1, 28, 28)
    y = torch.randint(0, 10, (20,))
    ds = TensorDataset(x, y)
    loader = DataLoader(ds, batch_size=8, shuffle=True)
    batch_x, batch_y = next(iter(loader))
    assert batch_x.shape[0] <= 8
    assert batch_y.shape[0] == batch_x.shape[0]


def test_checkpoint_save_load(tmp_path):
    device = get_device()
    model = MNISTCNN().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()
    x = torch.randn(4, 1, 28, 28, device=device)
    y = torch.tensor([0, 1, 2, 3], device=device)
    ds = TensorDataset(x.cpu(), y.cpu())
    loader = DataLoader(ds, batch_size=2)
    # Move loader data to device manually not needed; trainer handles .to(device)
    trainer = Trainer(model, loader, loader, criterion, optimizer, device, checkpoint_dir=str(tmp_path))
    trainer.fit(epochs=1)
    path = tmp_path / "ckpt.pt"
    trainer.save_checkpoint(str(path))
    assert path.exists()

    new_model = MNISTCNN().to(device)
    new_opt = torch.optim.Adam(new_model.parameters(), lr=1e-3)
    trainer2 = Trainer(new_model, loader, loader, criterion, new_opt, device, checkpoint_dir=str(tmp_path))
    trainer2.load_checkpoint(str(path))
    assert trainer2.history["train_loss"]
