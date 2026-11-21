"""Model registry read routes."""
from __future__ import annotations
from fastapi import APIRouter
from ..schemas import RegistryListResponse, RegistryModel
from ..services.registry import get_model, list_models

router = APIRouter(prefix="/registry", tags=["registry"])


@router.get("/models", response_model=RegistryListResponse)
def models():
    items = list_models()
    return RegistryListResponse(models=items, count=len(items))


@router.get("/models/{model_id}", response_model=RegistryModel)
def model_detail(model_id: str):
    return get_model(model_id)
