"""Pydantic schemas for model evaluation APIs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EvaluationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    batch_size: int = Field(64, ge=1, le=512)
    max_samples: int | None = Field(None, ge=1, le=100000)
    num_workers: int = Field(0, ge=0, le=8)

    @property
    def effective_max_samples(self) -> int | None:
        return self.max_samples


class CreateEvaluationRequest(BaseModel):
    model: str = Field(min_length=1, max_length=128)
    dataset: str = Field(min_length=1, max_length=64)
    config: dict[str, Any] = Field(default_factory=dict)


class EvaluationSummaryMetrics(BaseModel):
    accuracy: float | None = None
    macro_precision: float | None = None
    macro_recall: float | None = None
    macro_f1: float | None = None


class EvaluationResponse(BaseModel):
    evaluation_id: str
    model: str
    dataset: str
    architecture: str
    task: str
    state: str
    progress: float
    samples_evaluated: int
    total_samples: int
    metrics: EvaluationSummaryMetrics
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    elapsed_seconds: float | None
    cancel_requested: bool
    queue_position: int | None
    device: str | None
    artifact_dir: str
    source_checkpoint: str
    results_path: str | None
    metrics_path: str | None
    metadata_path: str | None
    error: dict[str, str] | None


class EvaluationListResponse(BaseModel):
    evaluations: list[EvaluationResponse]
    count: int


class EvaluationLogsResponse(BaseModel):
    evaluation_id: str
    lines: list[str]
    since: int
    next_since: int
    total_lines: int
    complete: bool


class ClassMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    support: int


class MacroMetrics(BaseModel):
    precision: float
    recall: float
    f1: float


class EvaluationResultsResponse(BaseModel):
    evaluation_id: str
    model: str
    dataset: str
    task: str
    state: str
    classes: list[str]
    sample_count: int
    evaluation_seconds: float
    accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    macro: MacroMetrics
    per_class: dict[str, ClassMetrics]
    confusion_matrix: list[list[int]]
    device: str | None
    completed_at: datetime | None
    artifact_dir: str
