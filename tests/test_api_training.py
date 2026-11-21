"""Tests for background training job APIs using a fake fast pipeline."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="deepvision-trainapi-"))
os.environ.setdefault("DEEPVISION_DATABASE_URL", f"sqlite:///{(_TMP / 'test.db').as_posix()}")

from fastapi.testclient import TestClient  # noqa: E402
from src.api.main import app  # noqa: E402
from src.api.training.pipelines import TrainingOutcome  # noqa: E402
from src.api.training.service import TrainingJobService  # noqa: E402
import src.api.training.service as service_module  # noqa: E402


def fake_pipeline(context):
    context.on_epoch_start(1, 1)
    context.on_batch_end(1, 1, 0.5)
    context.on_epoch_end({"epoch": 1, "train_loss": 0.5, "train_acc": 0.8, "val_loss": 0.4, "val_acc": 0.85})
    return TrainingOutcome(history={"train_loss": [0.5]}, best_val_acc=0.85, epochs_completed=1, elapsed_seconds=0.01)


@pytest.fixture(scope="module")
def client():
    service_module._service = TrainingJobService(artifact_root=_TMP / "artifacts", pipeline_resolver=lambda _: fake_pipeline)
    with TestClient(app) as c:
        yield c


def _wait(client, job_id, states=("SUCCEEDED", "FAILED", "CANCELLED"), tries=50):
    for _ in range(tries):
        job = client.get(f"/api/v1/training/jobs/{job_id}").json()
        if job["state"] in states:
            return job
        import time
        time.sleep(0.05)
    return job


def test_create_job(client):
    r = client.post("/api/v1/training/jobs", json={"model": "cifar10_custom_cnn", "dataset": "cifar10", "config": {"epochs": 1, "batch_size": 16}})
    assert r.status_code == 201
    body = r.json()
    assert body["state"] in ("QUEUED", "RUNNING", "SUCCEEDED")
    assert body["job_id"].startswith("job_")
    assert Path(body["artifact_dir"]).exists()


def test_invalid_model(client):
    assert client.post("/api/v1/training/jobs", json={"model": "nope", "dataset": "cifar10"}).status_code == 404


def test_incompatible_dataset(client):
    assert client.post("/api/v1/training/jobs", json={"model": "resnet18_finetuning", "dataset": "mnist"}).status_code == 422


def test_invalid_hyperparameters(client):
    r = client.post("/api/v1/training/jobs", json={"model": "cifar_cnn", "dataset": "cifar10", "config": {"epochs": 99}})
    assert r.status_code == 422


def test_list_and_get(client):
    r = client.get("/api/v1/training/jobs")
    assert r.status_code == 200
    assert r.json()["count"] >= 1
    job_id = r.json()["jobs"][0]["job_id"]
    assert client.get(f"/api/v1/training/jobs/{job_id}").status_code == 200


def test_missing_job(client):
    r = client.get("/api/v1/training/jobs/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_successful_job_progress_and_logs(client):
    job = client.post("/api/v1/training/jobs", json={"model": "mnist_cnn", "dataset": "mnist", "config": {"epochs": 1}}).json()
    job_id = job["job_id"]
    done = _wait(client, job_id)
    assert done["state"] == "SUCCEEDED"
    assert done["progress"] == 1.0
    assert done["metrics"]["val_acc"] is not None
    logs = client.get(f"/api/v1/training/jobs/{job_id}/logs").json()
    assert logs["total_lines"] >= 1


def test_cancel_terminal_job(client):
    job = client.post("/api/v1/training/jobs", json={"model": "mnist_cnn", "dataset": "mnist"}).json()
    done = _wait(client, job["job_id"])
    if done["state"] == "SUCCEEDED":
        r = client.post(f"/api/v1/training/jobs/{job['job_id']}/cancel")
        assert r.status_code == 409


def test_job_response_schema(client):
    job = client.get("/api/v1/training/jobs").json()["jobs"][0]
    for key in ["job_id", "model", "dataset", "state", "progress", "metrics", "artifact_dir", "checkpoint_path"]:
        assert key in job


def test_presets(client):
    r = client.get("/api/v1/training/presets")
    assert r.status_code == 200
    assert len(r.json()["models"]) >= 4
