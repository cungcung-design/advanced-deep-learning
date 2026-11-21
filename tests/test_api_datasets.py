"""Tests for dataset management APIs."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="deepvision-ds-"))
os.environ.setdefault("DEEPVISION_DATABASE_URL", f"sqlite:///{(_TMP / 'test.db').as_posix()}")

from fastapi.testclient import TestClient  # noqa: E402
from src.api.main import app  # noqa: E402
from src.api.services import datasets as ds_service  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_dataset_discovery(client):
    r = client.get("/api/v1/datasets")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 3
    ids = {d["dataset_id"] for d in body["datasets"]}
    assert ids == {"mnist", "cifar10", "imdb"}


def test_dataset_detail(client):
    r = client.get("/api/v1/datasets/cifar10")
    assert r.status_code == 200
    body = r.json()
    assert body["num_classes"] == 10
    assert body["input"] == {"channels": 3, "height": 32, "width": 32}
    assert body["classes"][0] == "airplane"


def test_dataset_statistics(client):
    r = client.get("/api/v1/datasets/mnist/statistics")
    assert r.status_code == 200
    body = r.json()
    assert body["expected_val_size"] == 6000
    assert body["expected_train_after_split"] == 54000


def test_validation_success(client):
    r = client.post("/api/v1/datasets/validate", json={"dataset_id": "cifar10"})
    assert r.status_code == 200
    assert r.json()["valid"] is True


def test_validation_unsupported(client):
    r = client.post("/api/v1/datasets/validate", json={"dataset_id": "unknown"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_validation_missing_local_files(client, monkeypatch, tmp_path):
    original = ds_service._dataset_defs
    def fake_defs():
        defs = original()
        defs[1]["root"] = tmp_path / "missing-cifar"
        return defs
    monkeypatch.setattr(ds_service, "_dataset_defs", fake_defs)
    body = ds_service.validate_dataset("cifar10")
    assert body["valid"] is False
    assert body["status"] == "invalid"
    assert body["missing_files"]


def test_dataset_summary_schema(client):
    body = client.get("/api/v1/datasets/imdb").json()
    for key in ["dataset_id", "display_name", "task", "train_size", "test_size", "classes", "preprocessing"]:
        assert key in body


def test_invalid_dataset_id(client):
    r = client.get("/api/v1/datasets/nope")
    assert r.status_code == 404


def test_no_auto_download(monkeypatch):
    from src.api.services.datasets import list_datasets
    items = list_datasets()
    assert all("available" in d for d in items)
    assert not any(d.get("download") for d in items)
