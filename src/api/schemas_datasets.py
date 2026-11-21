"""Dataset management schemas."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DatasetSummary(BaseModel):
    dataset_id: str
    display_name: str
    description: str
    dataset_type: str
    task: str
    source: str
    available: bool
    status: str
    missing_files: list[str]
    local_path: str
    local_size_bytes: int
    local_file_count: int
    train_size: int
    test_size: int
    val_fraction: float
    num_classes: int
    classes: list[str]
    input: dict[str, Any]
    preprocessing: dict[str, Any]
    config_path: str


class DatasetListResponse(BaseModel):
    datasets: list[DatasetSummary]
    count: int


class DatasetStatistics(BaseModel):
    dataset_id: str
    available: bool
    local_size_bytes: int
    local_file_count: int
    train_size: int
    test_size: int
    expected_val_size: int
    expected_train_after_split: int
    num_classes: int
    classes: list[str]


class ValidateRequest(BaseModel):
    dataset_id: str


class ValidationCheck(BaseModel):
    name: str
    passed: bool


class ValidationResponse(BaseModel):
    dataset_id: str
    valid: bool
    status: str
    checks: list[ValidationCheck]
    missing_files: list[str]
