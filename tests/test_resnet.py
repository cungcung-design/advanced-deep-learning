"""Tests for ResNet transfer-learning components."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
import torch

ROOT = Path(__file__).resolve().parents[1]


def load_eval_module():
    spec = importlib.util.spec_from_file_location("evaluate_module", ROOT / "scripts" / "evaluate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_evaluator_selects_cifar_cnn():
    mod = load_eval_module()
    model = mod.build_model("cifar_cnn")
    assert type(model).__name__ == "CifarCNN"


def test_evaluator_selects_resnet18():
    mod = load_eval_module()
    model = mod.build_model("resnet18")
    assert type(model).__name__ == "ResNet"


def test_evaluator_unknown_model():
    mod = load_eval_module()
    with pytest.raises(ValueError):
        mod.build_model("unknown")


def test_missing_checkpoint_handling(tmp_path, monkeypatch):
    mod = load_eval_module()
    config = tmp_path / "c.json"
    config.write_text('{"model":"cifar_cnn","checkpoint_path":"missing.pt","evaluation_path":"out.json","batch_size":8,"num_workers":0}')
    monkeypatch.setattr(mod, "ROOT", tmp_path)
    monkeypatch.setattr("sys.argv", ["evaluate.py", "--config", str(config)])
    with pytest.raises(FileNotFoundError):
        mod.main()


def test_resnet_checkpoint_roundtrip(tmp_path):
    from src.models import get_pretrained_resnet18
    model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False)
    path = tmp_path / "r.pt"
    torch.save({"model_state_dict": model.state_dict()}, path)
    new_model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False)
    ckpt = torch.load(path, map_location="cpu")
    new_model.load_state_dict(ckpt["model_state_dict"])
    assert new_model.fc.out_features == 10


def test_resnet_frozen_backbone():
    from src.models import get_pretrained_resnet18
    model = get_pretrained_resnet18(num_classes=10, freeze_backbone=True)
    assert all(not p.requires_grad for p in model.conv1.parameters())
    assert all(p.requires_grad for p in model.fc.parameters())

def test_optimized_config_layer_freezing():
    import json
    from pathlib import Path
    cfg = json.loads(Path("configs/resnet18_finetuning_optimized.json").read_text())
    assert cfg["image_size"] == 128
    assert cfg["batch_size"] == 64
    from src.models import get_pretrained_resnet18
    model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False)
    for name, p in model.named_parameters():
        p.requires_grad = name.startswith("layer4") or name.startswith("fc")
    assert all(not p.requires_grad for n, p in model.named_parameters() if n.startswith("layer3"))
    assert all(p.requires_grad for n, p in model.named_parameters() if n.startswith("layer4"))
