"""NLP inference adapters over the cached NLPService."""
from __future__ import annotations

import threading
import time
from pathlib import Path

import torch

from src.nlp.service import (
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_NER_MODEL,
    NLPService,
)

from ..config import settings
from ..errors import APIError
from src.nlp.huggingface import DEFAULT_SENTIMENT_MODEL

DEFAULT_MAX_TEXT_CHARS = 10_000  # documented API limit
EMBEDDING_MODEL = DEFAULT_EMBEDDING_MODEL
NER_MODEL = DEFAULT_NER_MODEL
PRETRAINED_SENTIMENT_MODEL = DEFAULT_SENTIMENT_MODEL
FINETUNED_SENTIMENT_MODEL = "distilbert_imdb_finetuned"


def _hf_cache_available(model_name: str) -> bool:
    repo = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_name.replace('/', '--')}"
    snapshots = repo / "snapshots"
    try:
        return snapshots.is_dir() and any(path.is_dir() for path in snapshots.iterdir())
    except OSError:
        return False


def _finetuned_checkpoint_available() -> bool:
    return (settings.artifact_root / "distilbert_imdb_finetuned.pt").is_file()


class NLPInferenceService:
    """Serializes CPU inference while reusing NLPService's model cache."""

    def __init__(self, service: NLPService | None = None) -> None:
        self._service = service or NLPService(local_files_only=True, device="cpu")
        self._lock = threading.RLock()
        self._inference_count = 0

    @property
    def inference_count(self) -> int:
        with self._lock:
            return self._inference_count

    def _run(self, operation):
        started = time.perf_counter()
        with self._lock:
            try:
                result = operation()
            except APIError:
                raise
            except (FileNotFoundError, OSError, EnvironmentError) as exc:
                raise APIError(
                    "MODEL_UNAVAILABLE",
                    "The requested NLP model is not available in the local model cache",
                    503,
                    {"local_files_only": True},
                ) from exc
            except ValueError as exc:
                raise APIError("VALIDATION_ERROR", "The NLP request could not be processed", 422) from exc
            except Exception as exc:  # keep model internals out of responses
                raise APIError(
                    "MODEL_LOAD_ERROR",
                    "The requested NLP model could not be loaded or run",
                    503,
                ) from exc
            self._inference_count += 1
        duration_ms = (time.perf_counter() - started) * 1000.0
        return result, round(duration_ms, 3)

    def sentiment(self, text: str, model: str = "finetuned") -> dict:
        result, duration = self._run(lambda: self._service.predict_sentiment(text, model=model))
        return {
            "task": "sentiment",
            "model_id": str(result.get("model") or (FINETUNED_SENTIMENT_MODEL if model == "finetuned" else PRETRAINED_SENTIMENT_MODEL)),
            "label": str(result["label"]),
            "score": float(result["score"]),
            "inference_ms": duration,
        }

    def embeddings(self, texts: list[str]) -> dict:
        tensor, duration = self._run(lambda: self._service.extract_embeddings(texts))
        if not isinstance(tensor, torch.Tensor) or tensor.ndim != 2:
            raise APIError("INFERENCE_FAILED", "The embedding model returned an invalid result", 500)
        if not bool(torch.isfinite(tensor).all()):
            raise APIError("INFERENCE_FAILED", "The embedding model returned invalid values", 500)
        values = [[float(value) for value in row] for row in tensor.detach().cpu().tolist()]
        return {
            "task": "embeddings",
            "model_id": EMBEDDING_MODEL,
            "count": len(values),
            "dimension": int(tensor.shape[1]),
            "embeddings": values,
            "inference_ms": duration,
        }

    def ner(self, text: str) -> dict:
        entities, duration = self._run(lambda: self._service.extract_entities(text))
        return {
            "task": "ner",
            "model_id": NER_MODEL,
            "entities": [
                {
                    "text": str(entity["text"]),
                    "label": str(entity["label"]),
                    "score": float(entity["score"]),
                }
                for entity in entities
            ],
            "inference_ms": duration,
        }

    def models(self) -> list[dict]:
        return [
            {
                "model_id": FINETUNED_SENTIMENT_MODEL,
                "display_name": "Fine-tuned DistilBERT IMDb sentiment",
                "task": "sentiment",
                "kind": "finetuned",
                "available": _finetuned_checkpoint_available(),
            },
            {
                "model_id": PRETRAINED_SENTIMENT_MODEL,
                "display_name": "Pretrained DistilBERT SST-2 sentiment",
                "task": "sentiment",
                "kind": "pretrained",
                "available": _hf_cache_available(PRETRAINED_SENTIMENT_MODEL),
            },
            {
                "model_id": EMBEDDING_MODEL,
                "display_name": "DistilBERT mean-pooled embeddings",
                "task": "embeddings",
                "kind": "pretrained",
                "available": _hf_cache_available(EMBEDDING_MODEL),
            },
            {
                "model_id": NER_MODEL,
                "display_name": "DistilBERT CoNLL-03 named entity recognition",
                "task": "ner",
                "kind": "pretrained",
                "available": _hf_cache_available(NER_MODEL),
            },
        ]


_service: NLPInferenceService | None = None
_service_lock = threading.Lock()


def get_nlp_inference_service() -> NLPInferenceService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = NLPInferenceService()
    return _service


def reset_nlp_inference_service() -> None:
    global _service
    with _service_lock:
        _service = None
