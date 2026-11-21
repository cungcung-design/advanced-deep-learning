"""Evaluation routes."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..evaluation import get_evaluation_service, presets
from ..schemas_evaluation import (
    CreateEvaluationRequest,
    EvaluationListResponse,
    EvaluationLogsResponse,
    EvaluationResponse,
    EvaluationResultsResponse,
)

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.get("/presets")
def evaluation_presets():
    return {"models": presets()}


@router.post("", response_model=EvaluationResponse, status_code=201)
def create_evaluation(payload: CreateEvaluationRequest):
    return get_evaluation_service().create_evaluation(payload.model, payload.dataset, payload.config)


@router.get("", response_model=EvaluationListResponse)
def list_evaluations(
    state: str | None = Query(None, pattern="^(QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED)$"),
    limit: int = Query(50, ge=1, le=200),
):
    items = get_evaluation_service().list_evaluations(state=state, limit=limit)
    return EvaluationListResponse(evaluations=items, count=len(items))


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
def get_evaluation(evaluation_id: str):
    return get_evaluation_service().get_evaluation(evaluation_id)


@router.get("/{evaluation_id}/results", response_model=EvaluationResultsResponse)
def get_results(evaluation_id: str):
    return get_evaluation_service().get_results(evaluation_id)


@router.get("/{evaluation_id}/logs", response_model=EvaluationLogsResponse)
def get_logs(evaluation_id: str, since: int = Query(0, ge=0), limit: int = Query(500, ge=1, le=2000)):
    return get_evaluation_service().read_logs(evaluation_id, since=since, limit=limit)


@router.post("/{evaluation_id}/cancel", response_model=EvaluationResponse)
def cancel_evaluation(evaluation_id: str):
    return get_evaluation_service().cancel_evaluation(evaluation_id)
