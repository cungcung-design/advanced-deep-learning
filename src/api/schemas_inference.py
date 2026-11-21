"""Pydantic schemas for image and NLP inference APIs."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_TEXT_CHARS = 10_000
MAX_EMBEDDING_TEXTS = 16


class ImageInputInfo(BaseModel):
    width: int
    height: int
    format: str


class ImageTopKPrediction(BaseModel):
    class_index: int
    label: str
    probability: float


class ImageInferenceResponse(BaseModel):
    model_id: str
    predicted_class: str
    class_index: int
    confidence: float
    top_k: list[ImageTopKPrediction]
    inference_ms: float
    image: ImageInputInfo


class ImageModelInfo(BaseModel):
    model_id: str
    display_name: str
    architecture: str
    dataset: str
    image_size: int | None
    available: bool


class ImageModelListResponse(BaseModel):
    models: list[ImageModelInfo]
    count: int


class SentimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    model: Literal["finetuned", "pretrained"] = "finetuned"

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("text must not be empty or whitespace only")
        return value


class SentimentResponse(BaseModel):
    task: str
    model_id: str
    label: str
    score: float
    inference_ms: float


class EmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    texts: list[str] = Field(min_length=1, max_length=MAX_EMBEDDING_TEXTS)

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            text = value.strip()
            if not text:
                raise ValueError("each text must be a non-empty string")
            if len(text) > MAX_TEXT_CHARS:
                raise ValueError(f"each text must be at most {MAX_TEXT_CHARS} characters")
            cleaned.append(text)
        return cleaned


class EmbeddingResponse(BaseModel):
    task: str
    model_id: str
    count: int
    dimension: int
    embeddings: list[list[float]]
    inference_ms: float


class NERRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("text must not be empty or whitespace only")
        return value


class NEREntity(BaseModel):
    text: str
    label: str
    score: float


class NERResponse(BaseModel):
    task: str
    model_id: str
    entities: list[NEREntity]
    inference_ms: float


class NLPModelInfo(BaseModel):
    model_id: str
    display_name: str
    task: str
    kind: str
    available: bool


class NLPModelListResponse(BaseModel):
    models: list[NLPModelInfo]
    count: int
