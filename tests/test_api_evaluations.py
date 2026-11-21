"""Tests for real model evaluation APIs using a synthetic evaluation pipeline."""
from __future__ import annotations

import os
import tempfile
import threading
import time
from pathlib import Path

import pytest
import torch
from torch.utils.data import DataLoader, TensorDataset

_TMP = Path(tempfile.mkdtemp(prefix="deepvision-evalapi-"))
os.environ.setdefault("DEEPVISION_DATABASE_URL", f"sqlite:///{(_TMP / 'test.db').as_posix()}")

from fastapi.testclient import TestClient  # noqa: E402

import src.api.evaluation.service as evaluation_service_module  # noqa: E402
from src.api.evaluation.metrics import compute_classification_metrics  # noqa: E402
from src.api.evaluation.pipelines import (  # noqa: E402
    EvaluationCancelled,
    EvaluationFailure,
    EvaluationOutcome,
    collect_predictions,
    load_model_state,
)
from src.api.evaluation.service import EvaluationJobService  # noqa: E402
from src.api.main import app  # noqa: E402
from src.api.db import EvaluationRecord, SessionLocal, init_db  # noqa: E402
from src.models import CifarCNN, MNISTCNN  # noqa: E402

ARTIFACT_ROOT = _TMP / "artifacts"
SLOW_STARTED = threading.Event()


def _synthetic_outcome(context) -> EvaluationOutcome:
    predictions = torch.tensor([0, 0, 1, 1])
    targets = torch.tensor([0, 1, 1, 1])
    context.on_progress(2, 4)
    context.log("synthetic inference complete")
    context.on_progress(4, 4)
    metrics = compute_classification_metrics(predictions, targets, context.classes)
    return EvaluationOutcome(
        task=context.task,
        classes=metrics["classes"],
        sample_count=metrics["sample_count"],
        accuracy=metrics["accuracy"],
        macro_precision=metrics["macro_precision"],
        macro_recall=metrics["macro_recall"],
        macro_f1=metrics["macro_f1"],
        macro=metrics["macro"],
        per_class=metrics["per_class"],
        confusion_matrix=metrics["confusion_matrix"],
        duration_seconds=0.01,
        device="cpu",
    )


def _success_pipeline(context):
    context.log("starting synthetic evaluation")
    return _synthetic_outcome(context)


def _failure_pipeline(context):
    raise EvaluationFailure("INVALID_CHECKPOINT", "The model checkpoint could not be read.")


def _unexpected_pipeline(context):
    raise RuntimeError("boom in C:\\secret\\internal\\path")


def _slow_pipeline(context):
    SLOW_STARTED.set()
    for step in range(1, 201):
        if context.cancel_event.is_set():
            raise EvaluationCancelled()
        context.on_progress(step, 200)
        time.sleep(0.02)
    return _synthetic_outcome(context)


def _resolver(family):
    if family == "cifar_cnn":
        return _failure_pipeline
    if family == "resnet18":
        return _slow_pipeline
    if family == "distilbert":
        return _unexpected_pipeline
    return _success_pipeline


@pytest.fixture(scope="module")
def service():
    evaluation_service_module._service = EvaluationJobService(
        artifact_root=ARTIFACT_ROOT, pipeline_resolver=_resolver, max_queue=10
    )
    return evaluation_service_module._service


@pytest.fixture(scope="module")
def client(service):
    with TestClient(app) as c:
        yield c


def _wait(client, evaluation_id, states=("SUCCEEDED", "FAILED", "CANCELLED"), tries=150):
    body = {}
    for _ in range(tries):
        body = client.get(f"/api/v1/evaluations/{evaluation_id}").json()
        if body.get("state") in states:
            return body
        time.sleep(0.05)
    return body


def _create(client, model="mnist_cnn", dataset="mnist", config=None):
    return client.post(
        "/api/v1/evaluations",
        json={
            "model": model,
            "dataset": dataset,
            "config": config or {"batch_size": 8, "max_samples": 4},
        },
    )


# --------------------------------------------------------------------- metrics
def test_metric_calculations_are_exact():
    metrics = compute_classification_metrics([0, 1, 1, 2], [0, 1, 2, 2], ["a", "b", "c"])
    assert metrics["accuracy"] == pytest.approx(0.75)
    assert metrics["sample_count"] == 4
    assert metrics["confusion_matrix"] == [[1, 0, 0], [0, 1, 0], [0, 1, 1]]
    assert metrics["per_class"]["a"] == {"precision": 1.0, "recall": 1.0, "f1": 1.0, "support": 1}
    assert metrics["per_class"]["b"]["precision"] == pytest.approx(0.5)
    assert metrics["per_class"]["c"]["recall"] == pytest.approx(0.5)
    assert metrics["macro"]["precision"] == pytest.approx(1 / 3 + 1 / 6 + 1 / 3)
    assert metrics["macro"]["f1"] == pytest.approx((1.0 + 2 / 3 + 2 / 3) / 3)


def test_zero_support_class_is_safe():
    metrics = compute_classification_metrics([0, 0], [0, 0], ["a", "b"])
    assert metrics["per_class"]["b"] == {"precision": 0.0, "recall": 0.0, "f1": 0.0, "support": 0}
    assert metrics["confusion_matrix"] == [[2, 0], [0, 0]]


class _SyntheticModel(torch.nn.Module):
    def forward(self, inputs):
        return inputs


def test_collect_predictions_with_tiny_synthetic_model():
    logits = torch.tensor([[2.0, 0.0], [0.0, 3.0], [1.0, 1.5], [4.0, 0.0]])
    labels = torch.tensor([0, 1, 1, 0])
    loader = DataLoader(TensorDataset(logits, labels), batch_size=2)
    seen: list[tuple[int, int]] = []
    preds, targets = collect_predictions(
        _SyntheticModel(), loader, torch.device("cpu"), threading.Event(), lambda d, t: seen.append((d, t))
    )
    assert preds.tolist() == [0, 1, 1, 0]
    assert targets.tolist() == [0, 1, 1, 0]
    assert seen[-1] == (4, 4)


def test_checkpoint_loading_and_failures(tmp_path):
    model = MNISTCNN()
    checkpoint = tmp_path / "tiny.pt"
    torch.save({"model_state_dict": model.state_dict()}, checkpoint)
    load_model_state(MNISTCNN(), checkpoint, torch.device("cpu"))

    with pytest.raises(EvaluationFailure) as missing:
        load_model_state(MNISTCNN(), tmp_path / "missing.pt", torch.device("cpu"))
    assert missing.value.code == "CHECKPOINT_MISSING"

    corrupt = tmp_path / "corrupt.pt"
    corrupt.write_bytes(b"not a checkpoint")
    with pytest.raises(EvaluationFailure) as invalid:
        load_model_state(MNISTCNN(), corrupt, torch.device("cpu"))
    assert invalid.value.code == "INVALID_CHECKPOINT"

    incompatible = tmp_path / "incompatible.pt"
    torch.save({"model_state_dict": CifarCNN().state_dict()}, incompatible)
    with pytest.raises(EvaluationFailure) as mismatch:
        load_model_state(MNISTCNN(), incompatible, torch.device("cpu"))
    assert mismatch.value.code == "INCOMPATIBLE_CHECKPOINT"


# ------------------------------------------------------------------------- API
def test_create_evaluation(client):
    r = _create(client)
    assert r.status_code == 201
    body = r.json()
    assert body["evaluation_id"].startswith("eval_")
    assert body["state"] in ("QUEUED", "RUNNING", "SUCCEEDED")
    assert body["artifact_dir"] == f"app/evaluations/{body['evaluation_id']}"
    assert (ARTIFACT_ROOT / body["artifact_dir"]).exists()


def test_status_transitions_and_results(client):
    body = _create(client).json()
    evaluation_id = body["evaluation_id"]
    done = _wait(client, evaluation_id)
    assert done["state"] == "SUCCEEDED"
    assert done["started_at"] and done["completed_at"]
    assert done["progress"] == 1.0
    assert done["samples_evaluated"] == 4
    assert done["metrics"]["accuracy"] == pytest.approx(0.75)

    results = client.get(f"/api/v1/evaluations/{evaluation_id}/results")
    assert results.status_code == 200
    payload = results.json()
    assert payload["accuracy"] == pytest.approx(0.75)
    assert payload["sample_count"] == 4
    assert len(payload["confusion_matrix"]) == 10
    assert len(payload["confusion_matrix"][0]) == 10
    assert payload["confusion_matrix"][0][0] == 1
    assert payload["confusion_matrix"][1][0] == 1
    assert payload["per_class"]["1"]["support"] == 3
    assert payload["macro"]["f1"] == pytest.approx(payload["macro_f1"])


def test_artifact_result_isolation(client):
    first = _create(client).json()
    second = _create(client).json()
    _wait(client, first["evaluation_id"])
    _wait(client, second["evaluation_id"])
    first_dir = ARTIFACT_ROOT / first["artifact_dir"]
    second_dir = ARTIFACT_ROOT / second["artifact_dir"]
    assert first_dir != second_dir
    assert (first_dir / "results.json").exists()
    assert (second_dir / "results.json").exists()
    assert (first_dir / "config.json").read_text() != ""


def test_logs_are_incremental(client):
    body = _create(client).json()
    _wait(client, body["evaluation_id"])
    logs = client.get(f"/api/v1/evaluations/{body['evaluation_id']}/logs").json()
    assert logs["total_lines"] >= 1
    assert logs["complete"] is True
    tail = client.get(
        f"/api/v1/evaluations/{body['evaluation_id']}/logs",
        params={"since": logs["next_since"]},
    ).json()
    assert tail["lines"] == []


def test_list_and_filter(client):
    r = client.get("/api/v1/evaluations", params={"state": "SUCCEEDED"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == len(body["evaluations"])
    assert body["count"] >= 1
    assert all(item["state"] == "SUCCEEDED" for item in body["evaluations"])


def test_invalid_model(client):
    r = _create(client, model="does-not-exist")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_unsupported_combination(client):
    r = _create(client, model="resnet18_finetuned", dataset="mnist")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_invalid_config(client):
    r = _create(client, config={"batch_size": 0})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    unknown = _create(client, config={"unknown_field": 3})
    assert unknown.status_code == 422


def test_missing_registered_checkpoint(client, monkeypatch):
    monkeypatch.setattr(
        evaluation_service_module,
        "get_model",
        lambda _model_id: {"available": False, "status": "missing", "error": "Checkpoint file not found"},
    )
    r = _create(client)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "MODEL_UNAVAILABLE"


def test_evaluation_failure_is_isolated(client):
    body = _create(client, model="cifar10_custom_cnn", dataset="cifar10").json()
    done = _wait(client, body["evaluation_id"])
    assert done["state"] == "FAILED"
    assert done["error"]["code"] == "INVALID_CHECKPOINT"
    assert client.get(f"/api/v1/evaluations/{body['evaluation_id']}/results").status_code == 409

    unexpected = _create(client, model="distilbert_imdb_finetuned", dataset="imdb").json()
    unexpected_done = _wait(client, unexpected["evaluation_id"])
    assert unexpected_done["state"] == "FAILED"
    assert unexpected_done["error"]["code"] == "EVALUATION_FAILED"
    assert "secret" not in unexpected_done["error"]["message"].lower()
    assert "\\" not in unexpected_done["error"]["message"]


def test_cancellation(client):
    SLOW_STARTED.clear()
    body = _create(client, model="resnet18_feature_extraction", dataset="cifar10").json()
    assert SLOW_STARTED.wait(5), "slow evaluation did not start"
    response = client.post(f"/api/v1/evaluations/{body['evaluation_id']}/cancel")
    assert response.status_code == 200
    done = _wait(client, body["evaluation_id"])
    assert done["state"] == "CANCELLED"
    assert done["cancel_requested"] is True


def test_cancel_terminal_evaluation(client):
    body = _create(client).json()
    done = _wait(client, body["evaluation_id"])
    assert done["state"] == "SUCCEEDED"
    r = client.post(f"/api/v1/evaluations/{body['evaluation_id']}/cancel")
    assert r.status_code == 409


def test_missing_evaluation(client):
    r = client.get("/api/v1/evaluations/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_response_schema(client):
    item = client.get("/api/v1/evaluations").json()["evaluations"][0]
    for key in [
        "evaluation_id",
        "model",
        "dataset",
        "state",
        "progress",
        "metrics",
        "artifact_dir",
        "source_checkpoint",
        "results_path",
        "error",
    ]:
        assert key in item
    assert set(item["metrics"]) == {"accuracy", "macro_precision", "macro_recall", "macro_f1"}


def test_presets(client):
    r = client.get("/api/v1/evaluations/presets")
    assert r.status_code == 200
    assert len(r.json()["models"]) == 6


# ----------------------------------------------------------------- persistence
def test_history_survives_new_service_instance(client):
    body = _create(client).json()
    _wait(client, body["evaluation_id"])
    fresh = EvaluationJobService(artifact_root=ARTIFACT_ROOT, pipeline_resolver=_resolver)
    restored = fresh.get_evaluation(body["evaluation_id"])
    assert restored["state"] == "SUCCEEDED"
    assert restored["metrics"]["accuracy"] == pytest.approx(0.75)


def test_interrupted_evaluation_is_marked_failed():
    init_db()
    evaluation_id = "eval_interrupted_test"
    artifact_dir = ARTIFACT_ROOT / "app" / "evaluations" / evaluation_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as session:
        session.add(
            EvaluationRecord(
                evaluation_id=evaluation_id,
                model_id="mnist_cnn",
                dataset_id="mnist",
                architecture="MNISTCNN",
                task="image_classification",
                config_json="{}",
                state="RUNNING",
                artifact_dir=str(artifact_dir),
                source_checkpoint=str(ARTIFACT_ROOT / "fake.pt"),
                metadata_path=str(artifact_dir / "evaluation.json"),
                log_path=str(artifact_dir / "evaluation.log"),
            )
        )
        session.commit()

    fresh = EvaluationJobService(artifact_root=ARTIFACT_ROOT, pipeline_resolver=_resolver)
    fresh.start()
    try:
        body = fresh.get_evaluation(evaluation_id)
        assert body["state"] == "FAILED"
        assert body["error"]["code"] == "RESTART_INTERRUPTED"
    finally:
        fresh.stop()
