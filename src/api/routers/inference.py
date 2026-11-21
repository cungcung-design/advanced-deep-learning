"""Inference routers for images and NLP."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from ..errors import APIError
from ..inference.image import MAX_UPLOAD_BYTES, get_image_inference_service
from ..inference.nlp import get_nlp_inference_service
from ..schemas_inference import (
    EmbeddingRequest,
    EmbeddingResponse,
    ImageInferenceResponse,
    ImageModelListResponse,
    NERRequest,
    NERResponse,
    NLPModelListResponse,
    SentimentRequest,
    SentimentResponse,
)

router = APIRouter(prefix="/inference", tags=["inference"])


@router.get("/image/models", response_model=ImageModelListResponse)
def list_image_models():
    models = get_image_inference_service().models()
    return ImageModelListResponse(models=models, count=len(models))


@router.post("/image", response_model=ImageInferenceResponse)
async def infer_image(
    file: UploadFile = File(...),
    model_id: str = Form(..., min_length=1, max_length=128),
    top_k: int = Form(3, ge=1, le=10),
):
    try:
        data = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()
    if len(data) > MAX_UPLOAD_BYTES:
        raise APIError(
            "FILE_TOO_LARGE",
            f"Image uploads are limited to {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
            413,
            {"max_bytes": MAX_UPLOAD_BYTES},
        )
    return get_image_inference_service().infer(data, file.content_type, model_id, top_k)


@router.get("/nlp/models", response_model=NLPModelListResponse)
def list_nlp_models():
    models = get_nlp_inference_service().models()
    return NLPModelListResponse(models=models, count=len(models))


@router.post("/nlp/sentiment", response_model=SentimentResponse)
def infer_sentiment(payload: SentimentRequest):
    return get_nlp_inference_service().sentiment(payload.text, model=payload.model)


@router.post("/nlp/embeddings", response_model=EmbeddingResponse)
def infer_embeddings(payload: EmbeddingRequest):
    return get_nlp_inference_service().embeddings(payload.texts)


@router.post("/nlp/ner", response_model=NERResponse)
def infer_ner(payload: NERRequest):
    return get_nlp_inference_service().ner(payload.text)
