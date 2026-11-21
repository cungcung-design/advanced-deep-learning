"""Training job routes."""
from __future__ import annotations
from fastapi import APIRouter, Query
from ..schemas_training import CreateTrainingJobRequest, TrainingJobListResponse, TrainingJobResponse, TrainingLogsResponse
from ..training import get_training_service, presets

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/presets")
def training_presets():
    return {"models": presets()}


@router.post("/jobs", response_model=TrainingJobResponse, status_code=201)
def create_job(payload: CreateTrainingJobRequest):
    return get_training_service().create_job(payload.model, payload.dataset, payload.config)


@router.get("/jobs", response_model=TrainingJobListResponse)
def list_jobs(limit: int = Query(50, ge=1, le=200)):
    jobs = get_training_service().list_jobs()[:limit]
    return TrainingJobListResponse(jobs=jobs, count=len(jobs))


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
def get_job(job_id: str):
    return get_training_service().get_job(job_id)


@router.post("/jobs/{job_id}/cancel", response_model=TrainingJobResponse)
def cancel_job(job_id: str):
    return get_training_service().cancel_job(job_id)


@router.get("/jobs/{job_id}/logs", response_model=TrainingLogsResponse)
def get_logs(job_id: str, since: int = Query(0, ge=0), limit: int = Query(500, ge=1, le=2000)):
    return get_training_service().read_logs(job_id, since=since, limit=limit)
