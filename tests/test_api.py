"""Tests for the FastAPI backend foundation (isolated DB, no network)."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="deepvision-api-"))
os.environ.setdefault("DEEPVISION_DATABASE_URL", f"sqlite:///{(_TMP / 'test.db').as_posix()}")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.main import app  # noqa: E402
from src.api.services.artifacts import resolve_allowed_path  # noqa: E402
from src.api.services.registry import get_model, list_models  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_startup_and_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert client.get("/api/v1/health").status_code == 200


def test_readiness(client):
    r = client.get("/api/v1/health/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["database"] is True
    assert body["artifact_root_writable"] is True


def test_settings_runtime(client):
    r = client.get("/api/v1/settings/runtime")
    assert r.status_code == 200
    body = r.json()
    assert body["device"] in ("cpu", "cuda")
    assert body["cuda_available"] is False
    assert body["torch_version"]


def test_settings_storage_and_models(client):
    assert client.get("/api/v1/settings/storage").status_code == 200
    body = client.get("/api/v1/settings/models").json()
    assert len(body["models"]) >= 6


def test_registry_discovery(client):
    r = client.get("/api/v1/registry/models")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == len(body["models"])
    ids = {m["model_id"] for m in body["models"]}
    assert "resnet18_finetuned" in ids
    assert "distilbert_imdb_finetuned" in ids


def test_registry_metrics_are_real():
    model = get_model("resnet18_finetuned")
    assert model["metrics"]["accuracy"] == pytest.approx(0.8644, abs=1e-4)
    assert model["checkpoint_size_bytes"] > 0


def test_registry_missing_model(client):
    r = client.get("/api/v1/registry/models/does-not-exist")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_path_traversal_rejected():
    from src.api.errors import APIError

    with pytest.raises(APIError):
        resolve_allowed_path("../../../../windows/win.ini")


def test_registry_models_are_available():
    models = list_models()
    assert any(m["available"] for m in models)
    for m in models:
        assert m["artifact_path"]


def test_unknown_route_error_shape(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404


def test_cors_headers(client):
    r = client.options("/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.status_code in (200, 204)
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
