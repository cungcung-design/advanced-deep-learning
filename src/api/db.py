"""SQLAlchemy engine, session, and application metadata models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


class AppMetadata(Base):
    __tablename__ = "app_metadata"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(512))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    model_id: Mapped[str] = mapped_column(String(64), index=True)
    dataset_id: Mapped[str] = mapped_column(String(64))
    config_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), index=True, default="QUEUED")
    current_epoch: Mapped[int] = mapped_column(Integer, default=0)
    total_epochs: Mapped[int] = mapped_column(Integer, default=0)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    train_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    val_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    train_acc: Mapped[float | None] = mapped_column(Float, nullable=True)
    val_acc: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_dir: Mapped[str] = mapped_column(String(512))
    checkpoint_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)


engine = create_engine(settings.database_url, connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_session():
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def database_ready(session: Session) -> bool:
    try:
        session.execute(select(1))
        return True
    except Exception:
        return False

class TrainingJobRecord(Base):
    __tablename__ = "training_job_records"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    model_id: Mapped[str] = mapped_column(String(64), index=True)
    dataset_id: Mapped[str] = mapped_column(String(64))
    config_json: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(16), index=True, default="QUEUED")
    current_epoch: Mapped[int] = mapped_column(Integer, default=0)
    total_epochs: Mapped[int] = mapped_column(Integer, default=0)
    current_batch: Mapped[int] = mapped_column(Integer, default=0)
    total_batches: Mapped[int] = mapped_column(Integer, default=0)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    train_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    val_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    train_acc: Mapped[float | None] = mapped_column(Float, nullable=True)
    val_acc: Mapped[float | None] = mapped_column(Float, nullable=True)
    elapsed_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    device: Mapped[str | None] = mapped_column(String(16), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_dir: Mapped[str] = mapped_column(String(512))
    config_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    checkpoint_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    history_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metrics_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metadata_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    log_path: Mapped[str | None] = mapped_column(String(512), nullable=True)


class EvaluationRecord(Base):
    __tablename__ = "evaluation_records"

    evaluation_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    model_id: Mapped[str] = mapped_column(String(64), index=True)
    dataset_id: Mapped[str] = mapped_column(String(64))
    architecture: Mapped[str] = mapped_column(String(64))
    task: Mapped[str] = mapped_column(String(64))
    config_json: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(16), index=True, default="QUEUED")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    samples_evaluated: Mapped[int] = mapped_column(Integer, default=0)
    total_samples: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    macro_precision: Mapped[float | None] = mapped_column(Float, nullable=True)
    macro_recall: Mapped[float | None] = mapped_column(Float, nullable=True)
    macro_f1: Mapped[float | None] = mapped_column(Float, nullable=True)
    elapsed_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    device: Mapped[str | None] = mapped_column(String(16), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_dir: Mapped[str] = mapped_column(String(512))
    source_checkpoint: Mapped[str] = mapped_column(String(512))
    source_config: Mapped[str | None] = mapped_column(String(512), nullable=True)
    results_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metrics_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metadata_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    log_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
