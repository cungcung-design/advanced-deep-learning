"""Real image classification inference over registered checkpoints."""
from __future__ import annotations

import io
import threading
import time
from pathlib import Path
from typing import Callable

import torch
import torch.nn as nn
from PIL import Image, UnidentifiedImageError

from ..errors import APIError
from ..evaluation.catalog import EVALUATION_SPECS, EvaluationSpec
from ..evaluation.pipelines import (
    EvaluationFailure,
    build_image_model,
    load_model_state,
)
from ..services.artifacts import resolve_allowed_path
from ..services.datasets import get_dataset
from ..services.registry import get_model

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
DEFAULT_TOP_K = 3

IMAGE_SPECS: dict[str, EvaluationSpec] = {
    spec.model_id: spec for spec in EVALUATION_SPECS if spec.task == "image_classification"
}

CheckpointResolver = Callable[[str], Path]


def _default_checkpoint_resolver(model_id: str) -> Path:
    info = get_model(model_id)
    if not info.get("available"):
        raise APIError(
            "MODEL_UNAVAILABLE",
            f"Model '{model_id}' is not available for inference",
            503,
        )
    return resolve_allowed_path(info["artifact_path"])


def preprocess_image(spec: EvaluationSpec, image: Image.Image) -> torch.Tensor:
    """Apply the registered model's real preprocessing to an uploaded image."""
    from torchvision import transforms

    size = int(spec.image_size or 32)
    if spec.family == "mnist_cnn":
        image = image.convert("L")
        transform = transforms.Compose(
            [
                transforms.Grayscale(num_output_channels=1),
                transforms.Resize((size, size)),
                transforms.ToTensor(),
                transforms.Normalize((0.1307,), (0.3081,)),
            ]
        )
    elif spec.family == "cifar_cnn":
        image = image.convert("RGB")
        transform = transforms.Compose(
            [
                transforms.Resize((size, size)),
                transforms.ToTensor(),
                transforms.Normalize(
                    (0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)
                ),
            ]
        )
    elif spec.family == "resnet18":
        image = image.convert("RGB")
        transform = transforms.Compose(
            [
                transforms.Resize(size),
                transforms.CenterCrop(size),
                transforms.ToTensor(),
                transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
            ]
        )
    else:
        raise APIError("UNSUPPORTED_MODEL", "No image preprocessing exists for this model", 400)
    return transform(image)


def decode_image(data: bytes, content_type: str | None) -> Image.Image:
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    if mime not in ALLOWED_MIME_TYPES:
        raise APIError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Upload a PNG, JPEG, or WebP image",
            415,
            {"allowed_types": sorted(ALLOWED_MIME_TYPES)},
        )
    if not data:
        raise APIError("INVALID_IMAGE", "The uploaded file is empty", 400)
    if len(data) > MAX_UPLOAD_BYTES:
        raise APIError(
            "FILE_TOO_LARGE",
            f"Image uploads are limited to {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
            413,
            {"max_bytes": MAX_UPLOAD_BYTES},
        )

    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        image = Image.open(io.BytesIO(data))
        width, height = image.size
        if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
            raise APIError("INVALID_IMAGE", "The uploaded image dimensions are not supported", 400)
        image.load()
    except APIError:
        raise
    except UnidentifiedImageError as exc:
        raise APIError("INVALID_IMAGE", "The uploaded file is not a valid image", 400) from exc
    except Image.DecompressionBombError as exc:
        raise APIError("INVALID_IMAGE", "The uploaded image is too large to decode", 400) from exc
    except (OSError, ValueError) as exc:
        raise APIError("INVALID_IMAGE", "The uploaded image is corrupted or unsupported", 400) from exc

    if image.format not in ALLOWED_FORMATS:
        raise APIError("UNSUPPORTED_MEDIA_TYPE", "Upload a PNG, JPEG, or WebP image", 415)
    return image


class ImageInferenceService:
    """Loads registered checkpoints once and runs thread-safe inference."""

    def __init__(self, checkpoint_resolver: CheckpointResolver | None = None) -> None:
        self._checkpoint_resolver = checkpoint_resolver or _default_checkpoint_resolver
        self._cache: dict[str, tuple[nn.Module, EvaluationSpec, list[str], tuple[int, int]]] = {}
        self._lock = threading.RLock()

    @property
    def loaded_model_ids(self) -> list[str]:
        with self._lock:
            return sorted(self._cache)

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()

    def _get_model(self, model_id: str):
        spec = IMAGE_SPECS.get(model_id.strip().lower())
        if spec is None:
            raise APIError(
                "NOT_FOUND",
                f"Model '{model_id}' is not supported for image inference",
                404,
                {"supported_models": sorted(IMAGE_SPECS)},
            )

        checkpoint = Path(self._checkpoint_resolver(spec.model_id))
        if not checkpoint.is_file():
            raise APIError(
                "MODEL_UNAVAILABLE",
                f"Model '{spec.model_id}' checkpoint file is missing",
                503,
            )
        try:
            stat = checkpoint.stat()
            fingerprint = (int(stat.st_mtime_ns), int(stat.st_size))
        except OSError as exc:
            raise APIError(
                "MODEL_UNAVAILABLE",
                f"Model '{spec.model_id}' checkpoint is not readable",
                503,
            ) from exc

        with self._lock:
            cached = self._cache.get(spec.model_id)
            if cached is not None and cached[3] == fingerprint:
                return cached[0], cached[1], cached[2]

            try:
                model = build_image_model(spec.family)
                load_model_state(model, checkpoint, torch.device("cpu"))
                model.eval()
            except EvaluationFailure as exc:
                raise APIError(
                    "MODEL_LOAD_ERROR",
                    "The registered model checkpoint could not be loaded",
                    503,
                    {"reason": exc.code},
                ) from exc
            except Exception as exc:  # never expose loader internals
                raise APIError(
                    "MODEL_LOAD_ERROR",
                    "The registered model checkpoint could not be loaded",
                    503,
                ) from exc

            classes = list(get_dataset(spec.dataset_id)["classes"])
            self._cache[spec.model_id] = (model, spec, classes, fingerprint)
            return model, spec, classes

    def infer(
        self,
        data: bytes,
        content_type: str | None,
        model_id: str,
        top_k: int = DEFAULT_TOP_K,
    ) -> dict:
        model, spec, classes = self._get_model(model_id)
        image = decode_image(data, content_type)
        tensor = preprocess_image(spec, image).unsqueeze(0)
        started = time.perf_counter()
        with torch.inference_mode():
            logits = model(tensor)
            probabilities = torch.softmax(logits, dim=-1)[0]
        if not bool(torch.isfinite(probabilities).all()):
            raise APIError("INFERENCE_FAILED", "The model returned invalid probabilities", 500)
        inference_ms = (time.perf_counter() - started) * 1000.0

        k = max(1, min(int(top_k), len(classes)))
        values, indices = torch.topk(probabilities, k)
        top_predictions = [
            {
                "class_index": int(index),
                "label": classes[int(index)],
                "probability": float(value),
            }
            for value, index in zip(values.tolist(), indices.tolist())
        ]
        best = top_predictions[0]
        return {
            "model_id": spec.model_id,
            "predicted_class": best["label"],
            "class_index": best["class_index"],
            "confidence": best["probability"],
            "top_k": top_predictions,
            "inference_ms": round(inference_ms, 3),
            "image": {
                "width": int(image.width),
                "height": int(image.height),
                "format": str(image.format),
            },
        }

    def models(self) -> list[dict]:
        items = []
        for spec in IMAGE_SPECS.values():
            available = True
            try:
                checkpoint = Path(self._checkpoint_resolver(spec.model_id))
                available = checkpoint.is_file()
            except APIError:
                available = False
            items.append(
                {
                    "model_id": spec.model_id,
                    "display_name": spec.display_name,
                    "architecture": spec.architecture,
                    "dataset": spec.dataset_id,
                    "image_size": spec.image_size,
                    "available": available,
                }
            )
        return items


_service: ImageInferenceService | None = None
_service_lock = threading.Lock()


def get_image_inference_service() -> ImageInferenceService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = ImageInferenceService()
    return _service


def reset_image_inference_service() -> None:
    global _service
    with _service_lock:
        _service = None
