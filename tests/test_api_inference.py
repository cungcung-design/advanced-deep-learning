"""Tests for image and NLP inference APIs with tiny synthetic models/fakes."""
from __future__ import annotations

import io
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
import torch
from PIL import Image

_TMP = Path(tempfile.mkdtemp(prefix="deepvision-inference-"))
os.environ.setdefault("DEEPVISION_DATABASE_URL", f"sqlite:///{(_TMP / 'test.db').as_posix()}")

from fastapi.testclient import TestClient  # noqa: E402

import src.api.inference.image as image_module  # noqa: E402
import src.api.inference.nlp as nlp_module  # noqa: E402
from src.api.inference.image import ImageInferenceService, preprocess_image  # noqa: E402
from src.api.inference.image import IMAGE_SPECS, MAX_UPLOAD_BYTES  # noqa: E402
from src.api.inference.nlp import NLPInferenceService  # noqa: E402
from src.api.main import app  # noqa: E402
from src.models import MNISTCNN  # noqa: E402


class FakeNLP:
    def __init__(self) -> None:
        self.calls = 0

    def predict_sentiment(self, text: str, model: str = "finetuned") -> dict:
        self.calls += 1
        return {
            "text": text,
            "label": "POSITIVE",
            "score": 0.9876,
            "model": "distilbert_imdb_finetuned" if model == "finetuned" else "distilbert-base-uncased-finetuned-sst-2-english",
        }

    def extract_embeddings(self, texts: list[str]) -> torch.Tensor:
        self.calls += 1
        return torch.tensor([[0.1, -0.2, 0.3] for _ in texts], dtype=torch.float32)

    def extract_entities(self, text: str) -> list[dict]:
        self.calls += 1
        return [{"text": "Paris", "label": "LOC", "score": 0.993}]


class UnavailableNLP:
    def predict_sentiment(self, text: str, model: str = "finetuned") -> dict:
        raise OSError("model is not present in the local cache")

    def extract_embeddings(self, texts: list[str]) -> torch.Tensor:
        raise OSError("model is not present in the local cache")

    def extract_entities(self, text: str) -> list[dict]:
        raise OSError("model is not present in the local cache")


@pytest.fixture(scope="module")
def image_checkpoint():
    path = _TMP / "tiny_mnist.pt"
    torch.save({"model_state_dict": MNISTCNN().state_dict()}, path)
    return path


@pytest.fixture(scope="module")
def fake_nlp():
    return FakeNLP()


@pytest.fixture(scope="module")
def client(image_checkpoint, fake_nlp):
    image_module._service = ImageInferenceService(checkpoint_resolver=lambda _model_id: image_checkpoint)
    nlp_module._service = NLPInferenceService(service=fake_nlp)
    with TestClient(app) as c:
        yield c


def _png(size=(28, 28), mode="L", color=0) -> bytes:
    buffer = io.BytesIO()
    Image.new(mode, size, color).save(buffer, format="PNG")
    return buffer.getvalue()


def _upload(client, data: bytes, model_id="mnist_cnn", top_k=3, content_type="image/png", filename="image.png"):
    return client.post(
        "/api/v1/inference/image",
        files={"file": (filename, data, content_type)},
        data={"model_id": model_id, "top_k": str(top_k)},
    )


# ---------------------------------------------------------------------- image
def test_valid_image_inference(client):
    r = _upload(client, _png())
    assert r.status_code == 200
    body = r.json()
    assert body["model_id"] == "mnist_cnn"
    assert body["predicted_class"] == body["top_k"][0]["label"]
    assert body["confidence"] == pytest.approx(body["top_k"][0]["probability"])
    assert body["image"] == {"width": 28, "height": 28, "format": "PNG"}
    assert body["inference_ms"] >= 0


def test_top_k_predictions(client):
    body = _upload(client, _png(), top_k=5).json()
    assert len(body["top_k"]) == 5
    probabilities = [item["probability"] for item in body["top_k"]]
    assert probabilities == sorted(probabilities, reverse=True)
    assert all(0.0 <= value <= 1.0 for value in probabilities)
    assert sum(probabilities) <= 1.0 + 1e-6


def test_top_k_is_capped_to_class_count(client):
    body = _upload(client, _png(), top_k=10).json()
    assert len(body["top_k"]) == 10


def test_incorrect_image_mime(client):
    r = _upload(client, b"plain text", content_type="text/plain", filename="note.txt")
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_corrupted_image(client):
    r = _upload(client, b"not really a png", content_type="image/png")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_IMAGE"


def test_oversized_upload(client):
    r = _upload(client, b"x" * (MAX_UPLOAD_BYTES + 1), content_type="image/png")
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_invalid_image_model(client):
    r = _upload(client, _png(), model_id="does-not-exist")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
    assert "mnist_cnn" in r.json()["error"]["details"]["supported_models"]


def test_missing_checkpoint(client):
    original = image_module._service
    image_module._service = ImageInferenceService(checkpoint_resolver=lambda _model_id: _TMP / "missing.pt")
    try:
        r = _upload(client, _png())
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "MODEL_UNAVAILABLE"
    finally:
        image_module._service = original


def test_corrupted_checkpoint_is_isolated(client):
    corrupt = _TMP / "corrupt.pt"
    corrupt.write_bytes(b"not a checkpoint")
    original = image_module._service
    image_module._service = ImageInferenceService(checkpoint_resolver=lambda _model_id: corrupt)
    try:
        r = _upload(client, _png())
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "MODEL_LOAD_ERROR"
        assert "not a checkpoint" not in r.json()["error"]["message"]
    finally:
        image_module._service = original


def test_model_preprocessing_shapes():
    grayscale = Image.new("RGBA", (100, 80), (255, 255, 255, 255))
    mnist = preprocess_image(IMAGE_SPECS["mnist_cnn"], grayscale)
    cifar = preprocess_image(IMAGE_SPECS["cifar10_custom_cnn"], grayscale)
    resnet = preprocess_image(IMAGE_SPECS["resnet18_finetuned"], grayscale)
    assert tuple(mnist.shape) == (1, 28, 28)
    assert tuple(cifar.shape) == (3, 32, 32)
    assert tuple(resnet.shape) == (3, 128, 128)


def test_model_cache_reuses_checkpoint(client):
    _upload(client, _png())
    _upload(client, _png())
    assert image_module._service.loaded_model_ids == ["mnist_cnn"]


def test_image_models_endpoint(client):
    r = client.get("/api/v1/inference/image/models")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 5
    ids = {item["model_id"] for item in body["models"]}
    assert {"mnist_cnn", "cifar10_custom_cnn", "resnet18_finetuned"} <= ids


# ------------------------------------------------------------------------ NLP
def test_sentiment_inference(client):
    r = client.post("/api/v1/inference/nlp/sentiment", json={"text": "A wonderful film"})
    assert r.status_code == 200
    body = r.json()
    assert body["task"] == "sentiment"
    assert body["model_id"] == "distilbert_imdb_finetuned"
    assert body["label"] == "POSITIVE"
    assert body["score"] == pytest.approx(0.9876)
    assert body["inference_ms"] >= 0


def test_pretrained_sentiment_inference(client):
    body = client.post(
        "/api/v1/inference/nlp/sentiment",
        json={"text": "Solid acting", "model": "pretrained"},
    ).json()
    assert body["model_id"] == "distilbert-base-uncased-finetuned-sst-2-english"


def test_embedding_shape_and_values(client):
    r = client.post("/api/v1/inference/nlp/embeddings", json={"texts": ["one", "two"]})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert body["dimension"] == 3
    assert len(body["embeddings"]) == 2
    assert all(len(row) == 3 for row in body["embeddings"])
    assert all(isinstance(value, float) for row in body["embeddings"] for value in row)


def test_ner_structured_output(client):
    r = client.post("/api/v1/inference/nlp/ner", json={"text": "Paris is in France"})
    assert r.status_code == 200
    body = r.json()
    assert body["task"] == "ner"
    assert body["entities"] == [{"text": "Paris", "label": "LOC", "score": pytest.approx(0.993)}]


def test_empty_and_blank_text(client):
    assert client.post("/api/v1/inference/nlp/sentiment", json={"text": ""}).status_code == 422
    assert client.post("/api/v1/inference/nlp/sentiment", json={"text": "   "}).status_code == 422
    assert client.post("/api/v1/inference/nlp/ner", json={"text": "\t\n"}).status_code == 422


def test_oversized_text_and_embedding_batch(client):
    assert client.post("/api/v1/inference/nlp/sentiment", json={"text": "x" * 10001}).status_code == 422
    assert client.post("/api/v1/inference/nlp/embeddings", json={"texts": ["x"] * 17}).status_code == 422


def test_unavailable_nlp_model(client, monkeypatch):
    monkeypatch.setattr(nlp_module, "_service", NLPInferenceService(service=UnavailableNLP()))
    r = client.post("/api/v1/inference/nlp/sentiment", json={"text": "hello"})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "MODEL_UNAVAILABLE"
    assert "OSError" not in r.json()["error"]["message"]
    assert "not present in the local cache" not in r.json()["error"]["message"]


def test_nlp_models_endpoint(client):
    r = client.get("/api/v1/inference/nlp/models")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 4
    tasks = {item["task"] for item in body["models"]}
    assert tasks == {"sentiment", "embeddings", "ner"}
    assert all("available" in item for item in body["models"])


def test_nlp_response_schemas(client):
    sentiment = client.post("/api/v1/inference/nlp/sentiment", json={"text": "ok"}).json()
    assert set(sentiment) == {"task", "model_id", "label", "score", "inference_ms"}
    embeddings = client.post("/api/v1/inference/nlp/embeddings", json={"texts": ["ok"]}).json()
    assert set(embeddings) == {"task", "model_id", "count", "dimension", "embeddings", "inference_ms"}


def test_nlp_service_caches_models_across_threads(tmp_path, monkeypatch):
    from src.nlp.service import NLPService
    import src.nlp.service as service_module

    checkpoint = tmp_path / "finetuned.pt"
    torch.save({"model_state_dict": {}}, checkpoint)
    calls = {"tokenizer": 0, "model": 0}

    class FakeModel:
        def load_state_dict(self, state):
            return None

        def to(self, device):
            return self

        def eval(self):
            return self

    def fake_tokenizer(*args, **kwargs):
        calls["tokenizer"] += 1
        return object()

    def fake_model(*args, **kwargs):
        calls["model"] += 1
        return FakeModel()

    monkeypatch.setattr(service_module.AutoTokenizer, "from_pretrained", fake_tokenizer)
    monkeypatch.setattr(service_module.AutoModelForSequenceClassification, "from_pretrained", fake_model)

    service = NLPService(finetuned_checkpoint=checkpoint, local_files_only=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        loaded = list(pool.map(lambda _: service._load_finetuned(), range(4)))
    assert len(loaded) == 4
    assert calls == {"tokenizer": 1, "model": 1}
    assert service.cached_tasks == ["finetuned"]

    service.clear_cache()
    assert service.cached_tasks == []
