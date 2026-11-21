"""Pydantic request/response schemas for the v1 API."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    app: str


class ReadinessResponse(BaseModel):
    status: str
    database: bool
    artifact_root: bool
    artifact_root_writable: bool


class RuntimeInfo(BaseModel):
    app_version: str
    python_version: str
    torch_version: str | None
    transformers_version: str | None
    device: str
    cuda_available: bool
    cpu_count: int | None
    threads: int | None
    platform: str


class MemoryInfo(BaseModel):
    total_bytes: int | None = None
    available_bytes: int | None = None


class StorageInfo(BaseModel):
    artifact_root: str
    artifact_bytes: int
    artifact_files: int
    data_root: str
    data_bytes: int
    data_files: int
    disk_total_bytes: int | None
    disk_free_bytes: int | None


class ModelCapability(BaseModel):
    model_id: str
    display_name: str
    task: str
    capabilities: list[str]


class SettingsResponse(BaseModel):
    runtime: RuntimeInfo
    memory: MemoryInfo
    storage: StorageInfo
    models: list[ModelCapability]


class EvaluationMetrics(BaseModel):
    accuracy: float | None = None
    macro_f1: float | None = None
    macro_precision: float | None = None
    macro_recall: float | None = None


class RegistryModel(BaseModel):
    model_id: str
    display_name: str
    architecture: str
    task: str
    artifact_path: str
    checkpoint_size_bytes: int | None
    config_path: str | None
    evaluation_path: str | None
    metrics: EvaluationMetrics
    available: bool
    status: str
    error: str | None = None


class RegistryListResponse(BaseModel):
    models: list[RegistryModel]
    count: int


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody
