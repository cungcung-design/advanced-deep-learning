"""Health and readiness routes."""
from __future__ import annotations
from fastapi import APIRouter, Response
from ..config import settings
from ..schemas import HealthResponse, ReadinessResponse
from ..services.health import readiness
from ..errors import APIError

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=settings.version, app=settings.app_name)


@router.get("/health/ready", response_model=ReadinessResponse)
def ready(response: Response) -> ReadinessResponse:
    payload = readiness()
    if payload["status"] != "ready":
        response.status_code = 503
    return ReadinessResponse(**payload)
