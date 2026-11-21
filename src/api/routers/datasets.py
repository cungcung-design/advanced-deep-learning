"""Dataset management routes."""
from __future__ import annotations
from fastapi import APIRouter
from ..errors import APIError
from ..schemas_datasets import DatasetListResponse, DatasetStatistics, DatasetSummary, ValidateRequest, ValidationResponse
from ..services.datasets import get_dataset, list_datasets, statistics, validate_dataset

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=DatasetListResponse)
def datasets():
    items = list_datasets()
    return DatasetListResponse(datasets=items, count=len(items))


@router.get("/{dataset_id}", response_model=DatasetSummary)
def dataset_detail(dataset_id: str):
    return get_dataset(dataset_id)


@router.get("/{dataset_id}/statistics", response_model=DatasetStatistics)
def dataset_statistics(dataset_id: str):
    return statistics(dataset_id)


@router.post("/validate", response_model=ValidationResponse)
def dataset_validate(payload: ValidateRequest):
    return validate_dataset(payload.dataset_id)
