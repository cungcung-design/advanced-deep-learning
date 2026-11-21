"""Training job persistence repository."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from ..db import SessionLocal, TrainingJob


def _to_dict(job: TrainingJob) -> dict:
    return {
        "job_id": job.job_id,
        "model_id": job.model_id,
        "dataset_id": job.dataset_id,
        "config": json.loads(job.config_json),
        "status": job.status,
        "current_epoch": job.current_epoch,
        "total_epochs": job.total_epochs,
        "progress": job.progress,
        "metrics": {
            "train_loss": job.train_loss,
            "val_loss": job.val_loss,
            "train_acc": job.train_acc,
            "val_acc": job.val_acc,
        },
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error": job.error,
        "artifact_dir": job.artifact_dir,
        "checkpoint_path": job.checkpoint_path,
        "cancel_requested": job.cancel_requested,
    }


def create_job(job_id: str, model_id: str, dataset_id: str, config: dict, total_epochs: int, artifact_dir: str) -> dict:
    with SessionLocal() as session:
        job = TrainingJob(
            job_id=job_id,
            model_id=model_id,
            dataset_id=dataset_id,
            config_json=json.dumps(config),
            status="QUEUED",
            total_epochs=total_epochs,
            artifact_dir=artifact_dir,
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return _to_dict(job)


def get_job(job_id: str) -> dict | None:
    with SessionLocal() as session:
        job = session.get(TrainingJob, job_id)
        return _to_dict(job) if job else None


def list_jobs(limit: int = 50) -> list[dict]:
    with SessionLocal() as session:
        jobs = session.query(TrainingJob).order_by(TrainingJob.created_at.desc()).limit(limit).all()
        return [_to_dict(j) for j in jobs]


def update_job(job_id: str, **fields) -> dict | None:
    with SessionLocal() as session:
        job = session.get(TrainingJob, job_id)
        if not job:
            return None
        for key, value in fields.items():
            if not hasattr(job, key):
                raise ValueError(f"unknown job field: {key}")
            setattr(job, key, value)
        session.commit()
        session.refresh(job)
        return _to_dict(job)


def mark_started(job_id: str) -> None:
    update_job(job_id, status="RUNNING", started_at=datetime.now(timezone.utc))


def mark_finished(job_id: str, status: str, error: str | None = None, checkpoint_path: str | None = None) -> None:
    update_job(
        job_id,
        status=status,
        error=error,
        checkpoint_path=checkpoint_path,
        completed_at=datetime.now(timezone.utc),
        progress=1.0 if status == "SUCCEEDED" else None,
    )


def request_cancel(job_id: str) -> dict | None:
    return update_job(job_id, cancel_requested=True)


def running_count() -> int:
    with SessionLocal() as session:
        return session.query(TrainingJob).filter(TrainingJob.status == "RUNNING").count()
