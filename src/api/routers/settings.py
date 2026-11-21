"""Settings read routes."""
from __future__ import annotations
from fastapi import APIRouter
from ..schemas import SettingsResponse
from ..services.settings import settings_payload

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/runtime")
def runtime():
    return settings_payload()["runtime"]


@router.get("/storage")
def storage():
    return settings_payload()["storage"]


@router.get("/models")
def models():
    return {"models": settings_payload()["models"]}


@router.get("", response_model=SettingsResponse)
def all_settings():
    return settings_payload()
