"""Tests for Milestone 2 CNN pipeline (synthetic, no download)."""
from __future__ import annotations

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from src.evaluation.metrics import confusion_matrix, per_class_metrics
from src.models import CifarCNN
from src.utils.device import get_device


def test_cifar_model_init():
    model = CifarCNN()
    assert len(list(model.parameters())) > 0


def test_cifar_forward_pass():
    device = get_device()
    model = CifarCNN().to(device).eval()
    x = torch.randn(2, 3, 32, 32, device=device)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (2, 10)


def test_cifar_output_shape():
    device = get_device()
    model = CifarCNN().to(device).eval()
    x = torch.randn(4, 3, 32, 32, device=device)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (4, 10)


def test_dataset_dataloader():
    x = torch.randn(16, 3, 32, 32)
    y = torch.randint(0, 10, (16,))
    ds = TensorDataset(x, y)
    loader = DataLoader(ds, batch_size=8)
    bx, by = next(iter(loader))
    assert bx.shape == (8, 3, 32, 32)
    assert by.shape == (8,)


def test_training_step():
    device = get_device()
    model = CifarCNN().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    crit = nn.CrossEntropyLoss()
    x = torch.randn(4, 3, 32, 32, device=device)
    y = torch.tensor([0, 1, 2, 3], device=device)
    out = model(x)
    loss = crit(out, y)
    opt.zero_grad()
    loss.backward()
    opt.step()
    assert torch.isfinite(loss)


def test_confusion_matrix():
    preds = torch.tensor([0, 1, 1, 2])
    targets = torch.tensor([0, 1, 2, 2])
    cm = confusion_matrix(preds, targets, 3)
    assert cm[0][0] == 1
    assert cm[2][2] == 1
    assert sum(sum(row) for row in cm) == 4


def test_per_class_metrics():
    cm = [[2, 0], [0, 2]]
    m = per_class_metrics(cm)
    assert m["macro"]["f1"] == 1.0
    assert m["0"]["precision"] == 1.0


def test_checkpoint_save_load(tmp_path):
    device = get_device()
    model = CifarCNN().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    crit = nn.CrossEntropyLoss()
    x = torch.randn(4, 3, 32, 32, device=device)
    y = torch.tensor([0, 1, 2, 3], device=device)
    ds = TensorDataset(x.cpu(), y.cpu())
    loader = DataLoader(ds, batch_size=2)
    from src.training.trainer import Trainer
    trainer = Trainer(model, loader, loader, crit, opt, device, checkpoint_dir=str(tmp_path))
    trainer.fit(epochs=1)
    path = tmp_path / "c.pt"
    trainer.save_checkpoint(str(path))
    assert path.exists()
    new_model = CifarCNN().to(device)
    new_opt = torch.optim.Adam(new_model.parameters(), lr=1e-3)
    t2 = Trainer(new_model, loader, loader, crit, new_opt, device, checkpoint_dir=str(tmp_path))
    t2.load_checkpoint(str(path))
    assert t2.history["train_loss"]
