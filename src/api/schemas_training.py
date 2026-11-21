"""Training job schemas."""
from __future__ import annotations
from typing import Any
from datetime import datetime

from pydantic import BaseModel, Field


class TrainingConfig(BaseModel):
    epochs: int = Field(1, ge=1, le=20)
    batch_size: int = Field(32, ge=1, le=512)
    learning_rate: float = Field(0.001, gt=0)
    weight_decay: float = Field(0.0005, ge=0)
    val_fraction: float = Field(0.1, gt=0, lt=0.5)
    seed: int = 42
    num_workers: int = Field(0, ge=0, le=8)
    image_size: int = Field(128, ge=28, le=224)


class CreateTrainingJobRequest(BaseModel):
    model: str
    dataset: str
    config: dict[str, Any] = Field(default_factory=dict)


class TrainingJobResponse(BaseModel):
    job_id: str
    model: str
    dataset: str
    state: str
    current_epoch: int
    total_epochs: int
    current_batch: int
    total_batches: int
    progress: float
    metrics: dict[str, float | None]
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    elapsed_seconds: float | None
    cancel_requested: bool
    queue_position: int | None
    device: str | None
    artifact_dir: str
    checkpoint_path: str | None
    history_path: str | None
    metrics_path: str | None
    metadata_path: str | None
    config_path: str | None
    error: dict[str, str] | None


class TrainingJobListResponse(BaseModel):
    jobs: list[TrainingJobResponse]
    count: int


class TrainingLogsResponse(BaseModel):
    job_id: str
    lines: list[str]
    since: int
    next_since: int
    total_lines: int
    complete: bool

