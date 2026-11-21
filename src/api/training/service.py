"""Thread-safe background training job service.

A single worker thread executes at most one training job at a time. Job
metadata is persisted in SQLite, and every job writes to a unique
directory under ``artifacts/app/<job_id>/``.
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from ..config import settings
from ..db import SessionLocal, TrainingJobRecord
from ..errors import APIError
from ..services.datasets import get_dataset
from .catalog import resolve_config, resolve_spec, validate_dataset_compatibility
from .pipelines import TrainingCancelled, TrainingContext, TrainingOutcome, resolve_pipeline

QUEUED = "QUEUED"
RUNNING = "RUNNING"
SUCCEEDED = "SUCCEEDED"
FAILED = "FAILED"
CANCELLED = "CANCELLED"

TERMINAL_STATES = frozenset({SUCCEEDED, FAILED, CANCELLED})
ALL_STATES = (QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED)

PipelineResolver = Callable[[str], Callable[[TrainingContext], TrainingOutcome]]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    os.replace(temp, path)


class TrainingJobService:
    """Owns the job queue, worker thread, persistence, and artifacts."""

    def __init__(
        self,
        session_factory: Callable[[], Any] | None = None,
        artifact_root: Path | None = None,
        pipeline_resolver: PipelineResolver | None = None,
        max_queue: int = 4,
    ) -> None:
        self._session_factory = session_factory or SessionLocal
        self._artifact_root = Path(artifact_root or settings.artifact_root)
        self._app_root = self._artifact_root / "app"
        self._resolve_pipeline = pipeline_resolver or resolve_pipeline
        self._max_queue = max_queue

        self._lock = threading.RLock()
        self._cv = threading.Condition(self._lock)
        self._queue: deque[str] = deque()
        self._cancel_events: dict[str, threading.Event] = {}
        self._logs: dict[str, list[str]] = {}
        self._live: dict[str, dict] = {}
        self._history: dict[str, list[dict]] = {}
        self._last_persist: dict[str, float] = {}
        self._thread: threading.Thread | None = None
        self._stop = False
        self._started = False
        self._active_job_id: str | None = None

    # ------------------------------------------------------------------ lifecycle
    def start(self) -> None:
        with self._cv:
            if self._thread is not None and self._thread.is_alive():
                return
            if not self._started:
                self._started = True
                self._recover_locked()
            self._stop = False
            self._thread = threading.Thread(target=self._worker_loop, name="training-worker", daemon=True)
            self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        with self._cv:
            self._stop = True
            self._cv.notify_all()
            thread = self._thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=timeout)

    # ------------------------------------------------------------------- creation
    def create_job(self, model: str, dataset: str, overrides: dict | None = None) -> dict:
        spec = resolve_spec(model)
        dataset_id = validate_dataset_compatibility(spec, dataset)
        info = get_dataset(dataset_id)
        if not info["available"]:
            raise APIError(
                "DATASET_UNAVAILABLE",
                f"Dataset '{dataset_id}' is not available locally",
                409,
                {"missing_files": info["missing_files"]},
            )
        config = resolve_config(spec, overrides)

        job_id = f"job_{uuid.uuid4().hex[:16]}"
        artifact_dir = self._validated_job_dir(job_id)
        paths = self._artifact_paths(artifact_dir)

        with self._cv:
            if len(self._queue) >= self._max_queue:
                raise APIError(
                    "QUEUE_FULL",
                    f"Training queue is full ({self._max_queue} pending jobs)",
                    409,
                    {"max_queue": self._max_queue},
                )
            try:
                artifact_dir.mkdir(parents=True, exist_ok=False)
            except FileExistsError as exc:
                raise APIError("CONFLICT", "Artifact directory already exists", 409) from exc

            _write_json_atomic(paths["config"], config)
            row = TrainingJobRecord(
                job_id=job_id,
                model_id=spec.model_id,
                dataset_id=dataset_id,
                config_json=json.dumps(config),
                state=QUEUED,
                current_epoch=0,
                total_epochs=int(config["epochs"]),
                current_batch=0,
                total_batches=0,
                progress=0.0,
                created_at=_utcnow(),
                cancel_requested=False,
                artifact_dir=str(artifact_dir),
                config_path=str(paths["config"]),
                checkpoint_path=str(paths["checkpoint"]),
                history_path=str(paths["history"]),
                metrics_path=str(paths["metrics"]),
                metadata_path=str(paths["metadata"]),
                log_path=str(paths["log"]),
            )
            with self._session_factory() as session:
                session.add(row)
                session.commit()

            self._cancel_events[job_id] = threading.Event()
            self._logs[job_id] = []
            self._history[job_id] = []
            self._write_snapshot(job_id)
            self._log(job_id, f"job created model={spec.model_id} dataset={dataset_id}", paths["log"])
            self._queue.append(job_id)
            self._cv.notify_all()

        self.start()
        return self.get_job(job_id)

    # -------------------------------------------------------------------- queries
    def get_job(self, job_id: str) -> dict:
        row = self._get_row(job_id)
        return self._payload(row)

    def list_jobs(self, state: str | None = None) -> list[dict]:
        with self._session_factory() as session:
            query = session.query(TrainingJobRecord)
            if state:
                query = query.filter(TrainingJobRecord.state == state)
            rows = query.order_by(TrainingJobRecord.created_at.desc()).all()
            return [self._payload(row) for row in rows]

    def read_logs(self, job_id: str, since: int = 0, limit: int = 500) -> dict:
        row = self._get_row(job_id)
        with self._lock:
            lines = list(self._logs.get(job_id, []))
        if not lines and row.log_path:
            path = Path(row.log_path)
            try:
                if path.exists():
                    lines = path.read_text(encoding="utf-8").splitlines()
            except OSError:
                lines = []
        since = max(0, int(since))
        selected = lines[since : since + limit]
        next_since = since + len(selected)
        return {
            "job_id": job_id,
            "lines": selected,
            "since": since,
            "next_since": next_since,
            "total_lines": len(lines),
            "complete": row.state in TERMINAL_STATES and next_since >= len(lines),
        }

    def cancel_job(self, job_id: str) -> dict:
        row = self._get_row(job_id)
        if row.state in TERMINAL_STATES:
            raise APIError("CANCELLED", f"Job '{job_id}' is already {row.state}", 409, {"state": row.state})

        with self._cv:
            event = self._cancel_events.setdefault(job_id, threading.Event())
            event.set()
            queued = False
            if job_id in self._queue:
                self._queue.remove(job_id)
                queued = True
            self._cv.notify_all()

        if queued:
            self._finalize_cancelled(job_id, elapsed=0.0)
        else:
            with self._session_factory() as session:
                record = session.get(TrainingJobRecord, job_id)
                if record is not None and record.state not in TERMINAL_STATES:
                    record.cancel_requested = True
                    session.commit()
            paths = self._artifact_paths(Path(row.artifact_dir))
            self._log(job_id, "cancellation requested", paths["log"])
        return self.get_job(job_id)

    def wait_for_terminal(self, job_id: str, timeout: float = 10.0) -> dict:
        return self.wait_for_state(job_id, TERMINAL_STATES, timeout=timeout)

    def wait_for_state(self, job_id: str, states, timeout: float = 10.0) -> dict:
        wanted = frozenset(states if not isinstance(states, str) else {states})
        deadline = time.monotonic() + timeout
        with self._cv:
            while True:
                row = self._get_row(job_id)
                if row.state in wanted:
                    return self._payload(row)
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"Job '{job_id}' did not reach {sorted(wanted)}")
                self._cv.wait(remaining)

    @property
    def active_job_id(self) -> str | None:
        return self._active_job_id

    @property
    def queued_job_ids(self) -> list[str]:
        with self._lock:
            return list(self._queue)

    # -------------------------------------------------------------------- worker
    def _worker_loop(self) -> None:
        while True:
            with self._cv:
                while not self._stop and not self._queue:
                    self._cv.wait(timeout=0.5)
                if self._stop:
                    return
                job_id = self._queue.popleft()
            try:
                self._execute(job_id)
            except Exception as exc:  # never let the worker thread die
                try:
                    self._finalize_failed(job_id, exc, elapsed=0.0)
                except Exception:
                    pass
            finally:
                with self._lock:
                    self._active_job_id = None
                    self._live.pop(job_id, None)

    def _execute(self, job_id: str) -> None:
        row = self._get_row(job_id)
        if row.state in TERMINAL_STATES:
            return

        event = self._cancel_events.setdefault(job_id, threading.Event())
        if event.is_set():
            self._finalize_cancelled(job_id, elapsed=0.0)
            return

        artifact_dir = Path(row.artifact_dir)
        paths = self._artifact_paths(artifact_dir)
        config = json.loads(row.config_json)
        started = _utcnow()
        start_monotonic = time.monotonic()

        with self._active_lock:
            self._active_job_id = job_id

        with self._session_factory() as session:
            record = session.get(TrainingJobRecord, job_id)
            record.state = RUNNING
            record.started_at = started
            record.cancel_requested = False
            session.commit()

        with self._lock:
            self._live[job_id] = {
                "current_epoch": 0,
                "current_batch": 0,
                "total_batches": 0,
                "progress": 0.0,
                "train_loss": None,
                "train_acc": None,
                "val_loss": None,
                "val_acc": None,
                "elapsed_seconds": 0.0,
            }
            self._history.setdefault(job_id, [])
            self._cv.notify_all()

        self._write_snapshot(job_id)
        self._log(job_id, f"job started device={row.device or 'cpu'}", paths["log"])

        def log(message: str) -> None:
            self._log(job_id, message, paths["log"])

        def on_epoch_start(epoch: int, total_epochs: int) -> None:
            with self._lock:
                live = self._live.setdefault(job_id, {})
                live["current_epoch"] = epoch
                live["current_batch"] = 0
                live["progress"] = (epoch - 1) / max(1, total_epochs)
                live["elapsed_seconds"] = time.monotonic() - start_monotonic
            self._log(job_id, f"epoch {epoch}/{total_epochs} started", paths["log"])

        def on_batch_end(epoch: int, batch: int, total_batches: int) -> None:
            total_epochs = int(config["epochs"])
            fraction = (batch / total_batches) if total_batches else 0.0
            progress = min(1.0, ((epoch - 1) + fraction) / max(1, total_epochs))
            with self._lock:
                live = self._live.setdefault(job_id, {})
                live.update(
                    {
                        "current_epoch": epoch,
                        "current_batch": batch,
                        "total_batches": total_batches,
                        "progress": progress,
                        "elapsed_seconds": time.monotonic() - start_monotonic,
                    }
                )
                should_persist = time.monotonic() - self._last_persist.get(job_id, 0.0) >= 0.5
                if should_persist:
                    self._last_persist[job_id] = time.monotonic()
            if should_persist:
                self._persist_progress(job_id, epoch, batch, total_batches, progress)

        def on_epoch_end(metrics: dict) -> None:
            epoch = int(metrics["epoch"])
            total_epochs = int(metrics.get("total_epochs", config["epochs"]))
            elapsed = time.monotonic() - start_monotonic
            with self._lock:
                self._history.setdefault(job_id, []).append(metrics)
                live = self._live.setdefault(job_id, {})
                live.update(
                    {
                        "current_epoch": epoch,
                        "current_batch": 0,
                        "progress": epoch / max(1, total_epochs),
                        "train_loss": metrics.get("train_loss"),
                        "train_acc": metrics.get("train_acc"),
                        "val_loss": metrics.get("val_loss"),
                        "val_acc": metrics.get("val_acc"),
                        "elapsed_seconds": elapsed,
                    }
                )
            self._persist_epoch(job_id, metrics, elapsed)
            self._write_snapshot(job_id)
            with self._cv:
                self._cv.notify_all()

        context = TrainingContext(
            job_id=job_id,
            model_id=row.model_id,
            dataset_id=row.dataset_id,
            config=config,
            artifact_dir=artifact_dir,
            cancel_event=event,
            log=log,
            on_epoch_start=on_epoch_start,
            on_batch_end=on_batch_end,
            on_epoch_end=on_epoch_end,
            checkpoint_partial_path=paths["checkpoint_partial"],
        )

        pipeline = self._resolve_pipeline(resolve_spec(row.model_id).pipeline)
        elapsed = 0.0
        try:
            outcome = pipeline(context)
            elapsed = outcome.elapsed_seconds
            if event.is_set():
                raise TrainingCancelled()
        except TrainingCancelled:
            self._finalize_cancelled(job_id, elapsed=time.monotonic() - start_monotonic)
        except Exception as exc:
            self._finalize_failed(job_id, exc, elapsed=time.monotonic() - start_monotonic)
        else:
            self._finalize_succeeded(job_id, outcome, elapsed=time.monotonic() - start_monotonic)

    # ------------------------------------------------------------------ finalizers
    def _finalize_succeeded(self, job_id: str, outcome: TrainingOutcome, elapsed: float) -> None:
        row = self._get_row(job_id)
        paths = self._artifact_paths(Path(row.artifact_dir))
        if paths["checkpoint_partial"].exists():
            os.replace(paths["checkpoint_partial"], paths["checkpoint"])

        with self._lock:
            history = list(self._history.get(job_id, []))
            live = dict(self._live.get(job_id, {}))

        final_metrics = {
            "job_id": job_id,
            "model": row.model_id,
            "dataset": row.dataset_id,
            "state": SUCCEEDED,
            "accuracy": outcome.best_val_acc,
            "best_val_accuracy": outcome.best_val_acc,
            "epochs_completed": outcome.epochs_completed,
            "final_epoch": live,
            "training_seconds": elapsed,
        }
        _write_json_atomic(paths["history"], {"job_id": job_id, "epochs": history})
        _write_json_atomic(paths["metrics"], final_metrics)

        spec = resolve_spec(row.model_id)
        registry_entry = {
            "job_id": job_id,
            "model_id": job_id,
            "display_name": f"{spec.display_name} ({job_id})",
            "architecture": spec.architecture,
            "task": "image_classification",
            "dataset": row.dataset_id,
            "checkpoint_path": str(paths["checkpoint"]),
            "config_path": str(paths["config"]),
            "metrics_path": str(paths["metrics"]),
            "created_at": _utcnow().isoformat(),
            "status": "trained",
        }
        _write_json_atomic(paths["registry"], registry_entry)

        with self._session_factory() as session:
            record = session.get(TrainingJobRecord, job_id)
            record.state = SUCCEEDED
            record.current_epoch = int(record.total_epochs)
            record.current_batch = 0
            record.total_batches = max(0, int(record.total_batches))
            record.progress = 1.0
            record.cancel_requested = False
            record.error_code = None
            record.error_message = None
            record.completed_at = _utcnow()
            record.elapsed_seconds = elapsed
            record.checkpoint_path = str(paths["checkpoint"])
            record.device = outcome.device
            session.commit()

        self._write_snapshot(job_id)
        self._log(job_id, f"job succeeded best_val_acc={outcome.best_val_acc}", paths["log"])
        self._finish(job_id)

    def _finalize_failed(self, job_id: str, exc: Exception, elapsed: float) -> None:
        row = self._get_row(job_id)
        paths = self._artifact_paths(Path(row.artifact_dir))
        message = f"{type(exc).__name__}: {exc}"

        with self._lock:
            history = list(self._history.get(job_id, []))

        _write_json_atomic(paths["history"], {"job_id": job_id, "epochs": history})
        _write_json_atomic(
            paths["metrics"],
            {"job_id": job_id, "model": row.model_id, "dataset": row.dataset_id, "state": FAILED, "error": message},
        )
        _write_json_atomic(paths["error"], {"code": "TRAINING_FAILED", "message": message})

        with self._session_factory() as session:
            record = session.get(TrainingJobRecord, job_id)
            record.state = FAILED
            record.error_code = "TRAINING_FAILED"
            record.error_message = message
            record.completed_at = _utcnow()
            record.elapsed_seconds = elapsed
            session.commit()

        self._write_snapshot(job_id)
        self._log(job_id, f"job failed: {message}", paths["log"])
        self._finish(job_id)

    def _finalize_cancelled(self, job_id: str, elapsed: float) -> None:
        row = self._get_row(job_id)
        paths = self._artifact_paths(Path(row.artifact_dir))

        with self._lock:
            history = list(self._history.get(job_id, []))
            live = dict(self._live.get(job_id, {}))

        _write_json_atomic(paths["history"], {"job_id": job_id, "epochs": history})
        _write_json_atomic(
            paths["metrics"],
            {
                "job_id": job_id,
                "model": row.model_id,
                "dataset": row.dataset_id,
                "state": CANCELLED,
                "accuracy": None,
                "epochs_completed": len(history),
                "final_epoch": live,
            },
        )

        with self._session_factory() as session:
            record = session.get(TrainingJobRecord, job_id)
            record.state = CANCELLED
            record.cancel_requested = True
            record.completed_at = _utcnow()
            record.elapsed_seconds = elapsed
            record.error_code = None
            record.error_message = None
            session.commit()

        self._write_snapshot(job_id)
        self._log(job_id, "job cancelled", paths["log"])
        self._finish(job_id)

    def _finish(self, job_id: str) -> None:
        with self._lock:
            self._live.pop(job_id, None)
            self._last_persist.pop(job_id, None)
            self._cv.notify_all()

    # ------------------------------------------------------------------ persistence
    def _persist_progress(self, job_id: str, epoch: int, batch: int, total_batches: int, progress: float) -> None:
        with self._session_factory() as session:
            record = session.get(TrainingJobRecord, job_id)
            if record is None or record.state != RUNNING:
                return
            record.current_epoch = epoch
            record.current_batch = batch
            record.total_batches = total_batches
            record.progress = progress
            session.commit()

    def _persist_epoch(self, job_id: str, metrics: dict, elapsed: float) -> None:
        with self._session_factory() as session:
            record = session.get(TrainingJobRecord, job_id)
            if record is None:
                return
            record.current_epoch = int(metrics["epoch"])
            record.current_batch = 0
            record.progress = int(metrics["epoch"]) / max(
                1, int(metrics.get("total_epochs", record.total_epochs))
            )
            record.train_loss = metrics.get("train_loss")
            record.train_acc = metrics.get("train_acc")
            record.val_loss = metrics.get("val_loss")
            record.val_acc = metrics.get("val_acc")
            record.elapsed_seconds = elapsed
            session.commit()

    def _write_snapshot(self, job_id: str) -> None:
        row = self._get_row(job_id)
        _write_json_atomic(
            Path(row.metadata_path),
            {
                "job_id": row.job_id,
                "model": row.model_id,
                "dataset": row.dataset_id,
                "state": row.state,
                "current_epoch": row.current_epoch,
                "total_epochs": row.total_epochs,
                "progress": row.progress,
                "created_at": _iso(row.created_at),
                "started_at": _iso(row.started_at),
                "completed_at": _iso(row.completed_at),
                "elapsed_seconds": row.elapsed_seconds,
                "artifact_dir": row.artifact_dir,
                "checkpoint_path": row.checkpoint_path,
                "error": (
                    {"code": row.error_code, "message": row.error_message}
                    if row.error_code
                    else None
                ),
            },
        )

    # -------------------------------------------------------------------- helpers
    def _get_row(self, job_id: str) -> TrainingJobRecord:
        with self._session_factory() as session:
            row = session.get(TrainingJobRecord, job_id)
            if row is None:
                raise APIError("NOT_FOUND", f"Training job '{job_id}' not found", 404)
            session.expunge(row)
            return row

    def _artifact_paths(self, artifact_dir: Path) -> dict[str, Path]:
        return {
            "config": artifact_dir / "config.json",
            "history": artifact_dir / "history.json",
            "metrics": artifact_dir / "metrics.json",
            "metadata": artifact_dir / "job.json",
            "checkpoint": artifact_dir / "checkpoint.pt",
            "checkpoint_partial": artifact_dir / "checkpoint_partial.pt",
            "registry": artifact_dir / "model.json",
            "error": artifact_dir / "error.json",
            "log": artifact_dir / "training.log",
        }

    def _validated_job_dir(self, job_id: str) -> Path:
        root = self._app_root.resolve()
        candidate = (self._app_root / job_id).resolve()
        if candidate.parent != root:
            raise APIError("INVALID_PATH", "Artifact directory escapes the artifact root", 400)
        return candidate

    def _log(self, job_id: str, message: str, log_path: Path) -> None:
        line = f"[{_utcnow().isoformat()}] {message}"
        with self._lock:
            self._logs.setdefault(job_id, []).append(line)
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
        except OSError:
            pass

    def _payload(self, row: TrainingJobRecord) -> dict:
        with self._lock:
            live = dict(self._live.get(row.job_id, {}))
            queue_position = None
            if row.state == QUEUED and row.job_id in self._queue:
                queue_position = self._queue.index(row.job_id) + 1

        current_epoch = live.get("current_epoch", row.current_epoch)
        current_batch = live.get("current_batch", row.current_batch)
        total_batches = live.get("total_batches", row.total_batches)
        progress = live.get("progress", row.progress)
        elapsed = live.get("elapsed_seconds", row.elapsed_seconds)

        return {
            "job_id": row.job_id,
            "model": row.model_id,
            "dataset": row.dataset_id,
            "state": row.state,
            "current_epoch": int(current_epoch or 0),
            "total_epochs": int(row.total_epochs),
            "current_batch": int(current_batch or 0),
            "total_batches": int(total_batches or 0),
            "progress": float(progress or 0.0),
            "metrics": {
                "train_loss": live.get("train_loss", row.train_loss),
                "train_acc": live.get("train_acc", row.train_acc),
                "val_loss": live.get("val_loss", row.val_loss),
                "val_acc": live.get("val_acc", row.val_acc),
            },
            "created_at": row.created_at,
            "started_at": row.started_at,
            "completed_at": row.completed_at,
            "elapsed_seconds": elapsed,
            "cancel_requested": bool(row.cancel_requested),
            "queue_position": queue_position,
            "device": row.device,
            "artifact_dir": row.artifact_dir,
            "checkpoint_path": row.checkpoint_path,
            "history_path": row.history_path,
            "metrics_path": row.metrics_path,
            "metadata_path": row.metadata_path,
            "config_path": row.config_path,
            "error": (
                {"code": row.error_code, "message": row.error_message}
                if row.error_code
                else None
            ),
        }

    def _recover_locked(self) -> None:
        """Reconcile jobs left behind by a previous backend process."""
        with self._session_factory() as session:
            rows = session.query(TrainingJobRecord).all()
            for row in rows:
                if row.state == RUNNING:
                    row.state = FAILED
                    row.error_code = "RESTART_INTERRUPTED"
                    row.error_message = (
                        "Backend restarted while the job was running. The single-process "
                        "runner cannot resume interrupted training jobs."
                    )
                    row.completed_at = _utcnow()
                    try:
                        art = Path(row.artifact_dir)
                        _write_json_atomic(
                            art / "job.json",
                            {
                                "job_id": row.job_id,
                                "model": row.model_id,
                                "dataset": row.dataset_id,
                                "state": FAILED,
                                "error": {"code": row.error_code, "message": row.error_message},
                            },
                        )
                    except OSError:
                        pass
                elif row.state == QUEUED and row.job_id not in self._queue:
                    self._queue.append(row.job_id)
                    self._cancel_events.setdefault(row.job_id, threading.Event())
            session.commit()

    # The active job id is only read by observability helpers.
    _active_lock = threading.Lock()


_service: TrainingJobService | None = None
_service_lock = threading.Lock()


def get_training_service() -> TrainingJobService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = TrainingJobService()
    return _service


def reset_training_service() -> None:
    global _service
    with _service_lock:
        if _service is not None:
            _service.stop()
            _service = None
