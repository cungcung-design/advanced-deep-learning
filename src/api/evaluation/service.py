"""Thread-safe background evaluation service.

A single worker executes one evaluation at a time. Evaluation metadata and
results live in SQLite and in ``artifacts/app/evaluations/<evaluation_id>/``.
Metrics are always computed by running the registered checkpoint on the
dataset's held-out test split.
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
from ..db import EvaluationRecord, SessionLocal
from ..errors import APIError
from ..services.artifacts import resolve_allowed_path
from ..services.datasets import get_dataset
from ..services.registry import get_model
from .catalog import EvaluationSpec, resolve_evaluation_config, resolve_evaluation_spec
from .pipelines import (
    EvaluationCancelled,
    EvaluationContext,
    EvaluationFailure,
    EvaluationOutcome,
    resolve_evaluation_pipeline,
)

QUEUED = "QUEUED"
RUNNING = "RUNNING"
SUCCEEDED = "SUCCEEDED"
FAILED = "FAILED"
CANCELLED = "CANCELLED"

TERMINAL_STATES = frozenset({SUCCEEDED, FAILED, CANCELLED})
ALL_STATES = (QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED)

PipelineResolver = Callable[[str], Callable[[EvaluationContext], EvaluationOutcome]]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    os.replace(temp, path)


class EvaluationJobService:
    """Owns the evaluation queue, worker thread, persistence, and results."""

    def __init__(
        self,
        session_factory: Callable[[], Any] | None = None,
        artifact_root: Path | None = None,
        pipeline_resolver: PipelineResolver | None = None,
        max_queue: int = 4,
    ) -> None:
        self._session_factory = session_factory or SessionLocal
        self._artifact_root = Path(artifact_root or settings.artifact_root)
        self._app_root = self._artifact_root / "app" / "evaluations"
        self._resolve_pipeline = pipeline_resolver or resolve_evaluation_pipeline
        self._max_queue = max_queue

        self._lock = threading.RLock()
        self._cv = threading.Condition(self._lock)
        self._queue: deque[str] = deque()
        self._cancel_events: dict[str, threading.Event] = {}
        self._logs: dict[str, list[str]] = {}
        self._live: dict[str, dict] = {}
        self._last_persist: dict[str, float] = {}
        self._thread: threading.Thread | None = None
        self._stop = False
        self._started = False
        self._active_lock = threading.Lock()
        self._active_evaluation_id: str | None = None

    # ------------------------------------------------------------------ lifecycle
    def start(self) -> None:
        with self._cv:
            if self._thread is not None and self._thread.is_alive():
                return
            if not self._started:
                self._started = True
                self._recover_locked()
            self._stop = False
            self._thread = threading.Thread(
                target=self._worker_loop, name="evaluation-worker", daemon=True
            )
            self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        with self._cv:
            self._stop = True
            self._cv.notify_all()
            thread = self._thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=timeout)

    @property
    def active_evaluation_id(self) -> str | None:
        return self._active_evaluation_id

    @property
    def queued_evaluation_ids(self) -> list[str]:
        with self._lock:
            return list(self._queue)

    # ------------------------------------------------------------------- creation
    def create_evaluation(self, model: str, dataset: str, overrides: dict | None = None) -> dict:
        spec = resolve_evaluation_spec(model, dataset)
        model_info = get_model(spec.model_id)
        if not model_info.get("available"):
            raise APIError(
                "MODEL_UNAVAILABLE",
                f"Model '{spec.model_id}' is not available for evaluation",
                409,
                {"status": model_info.get("status"), "reason": model_info.get("error")},
            )
        checkpoint = resolve_allowed_path(model_info["artifact_path"])
        if not checkpoint.is_file():
            raise APIError(
                "MODEL_UNAVAILABLE",
                f"Model '{spec.model_id}' checkpoint file is missing",
                409,
            )
        dataset_info = get_dataset(spec.dataset_id)
        if not dataset_info["available"]:
            raise APIError(
                "DATASET_UNAVAILABLE",
                f"Dataset '{spec.dataset_id}' is not available locally",
                409,
                {"missing_files": dataset_info["missing_files"]},
            )
        config = resolve_evaluation_config(spec, overrides)

        evaluation_id = f"eval_{uuid.uuid4().hex[:16]}"
        artifact_dir = self._validated_artifact_dir(evaluation_id)
        paths = self._artifact_paths(artifact_dir)

        with self._cv:
            if len(self._queue) >= self._max_queue:
                raise APIError(
                    "QUEUE_FULL",
                    f"Evaluation queue is full ({self._max_queue} pending evaluations)",
                    409,
                    {"max_queue": self._max_queue},
                )
            try:
                artifact_dir.mkdir(parents=True, exist_ok=False)
            except FileExistsError as exc:
                raise APIError("CONFLICT", "Evaluation artifact directory already exists", 409) from exc

            _write_json_atomic(
                paths["config"],
                {
                    "evaluation_id": evaluation_id,
                    "model": spec.model_id,
                    "dataset": spec.dataset_id,
                    "architecture": spec.architecture,
                    "task": spec.task,
                    "config": config,
                },
            )
            row = EvaluationRecord(
                evaluation_id=evaluation_id,
                model_id=spec.model_id,
                dataset_id=spec.dataset_id,
                architecture=spec.architecture,
                task=spec.task,
                config_json=json.dumps(config),
                state=QUEUED,
                progress=0.0,
                samples_evaluated=0,
                total_samples=0,
                created_at=_utcnow(),
                cancel_requested=False,
                artifact_dir=str(artifact_dir),
                source_checkpoint=str(checkpoint),
                source_config=model_info.get("config_path"),
                results_path=str(paths["results"]),
                metrics_path=str(paths["metrics"]),
                metadata_path=str(paths["metadata"]),
                log_path=str(paths["log"]),
            )
            with self._session_factory() as session:
                session.add(row)
                session.commit()

            self._cancel_events[evaluation_id] = threading.Event()
            self._logs[evaluation_id] = []
            self._live[evaluation_id] = {"samples_evaluated": 0, "total_samples": 0, "progress": 0.0}
            self._write_snapshot(evaluation_id)
            self._log(evaluation_id, f"evaluation created model={spec.model_id} dataset={spec.dataset_id}")
            self._queue.append(evaluation_id)
            self._cv.notify_all()

        self.start()
        return self.get_evaluation(evaluation_id)

    # -------------------------------------------------------------------- queries
    def get_evaluation(self, evaluation_id: str) -> dict:
        return self._payload(self._get_row(evaluation_id))

    def list_evaluations(self, state: str | None = None, limit: int = 50) -> list[dict]:
        with self._session_factory() as session:
            query = session.query(EvaluationRecord)
            if state:
                query = query.filter(EvaluationRecord.state == state)
            rows = query.order_by(EvaluationRecord.created_at.desc()).limit(limit).all()
            return [self._payload(row) for row in rows]

    def read_logs(self, evaluation_id: str, since: int = 0, limit: int = 500) -> dict:
        row = self._get_row(evaluation_id)
        with self._lock:
            lines = list(self._logs.get(evaluation_id, []))
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
            "evaluation_id": evaluation_id,
            "lines": selected,
            "since": since,
            "next_since": next_since,
            "total_lines": len(lines),
            "complete": row.state in TERMINAL_STATES and next_since >= len(lines),
        }

    def get_results(self, evaluation_id: str) -> dict:
        row = self._get_row(evaluation_id)
        if row.state != SUCCEEDED:
            raise APIError(
                "RESULTS_NOT_AVAILABLE",
                f"Evaluation '{evaluation_id}' has no results in state {row.state}",
                409,
                {"state": row.state},
            )
        if not row.results_path:
            raise APIError("RESULTS_NOT_AVAILABLE", "Evaluation results are not available", 409)
        path = Path(row.results_path).resolve()
        root = self._artifact_root.resolve()
        if not (path == root or root in path.parents):
            raise APIError("INVALID_PATH", "Evaluation results are outside approved storage", 400)
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise APIError("RESULTS_NOT_AVAILABLE", "Evaluation results are missing or corrupted", 409) from exc

    def cancel_evaluation(self, evaluation_id: str) -> dict:
        row = self._get_row(evaluation_id)
        if row.state in TERMINAL_STATES:
            raise APIError(
                "CANCELLED",
                f"Evaluation '{evaluation_id}' is already {row.state}",
                409,
                {"state": row.state},
            )

        with self._cv:
            event = self._cancel_events.setdefault(evaluation_id, threading.Event())
            event.set()
            queued = False
            if evaluation_id in self._queue:
                self._queue.remove(evaluation_id)
                queued = True
            self._cv.notify_all()

        if queued:
            self._finalize_cancelled(evaluation_id, elapsed=0.0)
        else:
            with self._session_factory() as session:
                record = session.get(EvaluationRecord, evaluation_id)
                if record is not None and record.state not in TERMINAL_STATES:
                    record.cancel_requested = True
                    session.commit()
            self._log(evaluation_id, "cancellation requested")
        return self.get_evaluation(evaluation_id)

    def wait_for_terminal(self, evaluation_id: str, timeout: float = 10.0) -> dict:
        return self.wait_for_state(evaluation_id, TERMINAL_STATES, timeout=timeout)

    def wait_for_state(self, evaluation_id: str, states, timeout: float = 10.0) -> dict:
        wanted = frozenset(states if not isinstance(states, str) else {states})
        deadline = time.monotonic() + timeout
        with self._cv:
            while True:
                row = self._get_row(evaluation_id)
                if row.state in wanted:
                    return self._payload(row)
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"Evaluation '{evaluation_id}' did not reach {sorted(wanted)}")
                self._cv.wait(remaining)

    # -------------------------------------------------------------------- worker
    def _worker_loop(self) -> None:
        while True:
            with self._cv:
                while not self._stop and not self._queue:
                    self._cv.wait(timeout=0.5)
                if self._stop:
                    return
                evaluation_id = self._queue.popleft()
            try:
                self._execute(evaluation_id)
            except Exception as exc:  # never let the worker thread die
                try:
                    self._finalize_failed(
                        evaluation_id,
                        "EVALUATION_FAILED",
                        "The evaluation failed unexpectedly.",
                        detail=f"{type(exc).__name__}",
                        elapsed=0.0,
                    )
                except Exception:
                    pass
            finally:
                with self._lock:
                    self._active_evaluation_id = None
                    self._live.pop(evaluation_id, None)

    def _execute(self, evaluation_id: str) -> None:
        row = self._get_row(evaluation_id)
        if row.state in TERMINAL_STATES:
            return

        event = self._cancel_events.setdefault(evaluation_id, threading.Event())
        if event.is_set():
            self._finalize_cancelled(evaluation_id, elapsed=0.0)
            return

        artifact_dir = Path(row.artifact_dir)
        paths = self._artifact_paths(artifact_dir)
        config = json.loads(row.config_json)
        start_monotonic = time.monotonic()

        with self._active_lock:
            self._active_evaluation_id = evaluation_id

        with self._session_factory() as session:
            record = session.get(EvaluationRecord, evaluation_id)
            record.state = RUNNING
            record.started_at = _utcnow()
            record.cancel_requested = False
            session.commit()

        with self._lock:
            self._live[evaluation_id] = {
                "samples_evaluated": 0,
                "total_samples": 0,
                "progress": 0.0,
            }
            self._cv.notify_all()

        self._write_snapshot(evaluation_id)
        self._log(evaluation_id, "evaluation started")

        def log(message: str) -> None:
            self._log(evaluation_id, message)

        def on_progress(done: int, total: int) -> None:
            progress = (done / total) if total else 0.0
            with self._lock:
                live = self._live.setdefault(evaluation_id, {})
                live.update(
                    {
                        "samples_evaluated": done,
                        "total_samples": total,
                        "progress": min(1.0, progress),
                        "elapsed_seconds": time.monotonic() - start_monotonic,
                    }
                )
                should_persist = time.monotonic() - self._last_persist.get(evaluation_id, 0.0) >= 0.5
                if should_persist:
                    self._last_persist[evaluation_id] = time.monotonic()
            if should_persist:
                self._persist_progress(evaluation_id, done, total, progress)
                with self._cv:
                    self._cv.notify_all()

        context = EvaluationContext(
            evaluation_id=evaluation_id,
            model_id=row.model_id,
            dataset_id=row.dataset_id,
            family=resolve_evaluation_spec(row.model_id, row.dataset_id).family,
            task=row.task,
            architecture=row.architecture,
            config=config,
            artifact_dir=artifact_dir,
            checkpoint_path=Path(row.source_checkpoint),
            image_size=resolve_evaluation_spec(row.model_id, row.dataset_id).image_size,
            classes=get_dataset(row.dataset_id)["classes"],
            cancel_event=event,
            log=log,
            on_progress=on_progress,
        )

        spec = resolve_evaluation_spec(row.model_id, row.dataset_id)
        pipeline = self._resolve_pipeline(spec.family)
        try:
            outcome = pipeline(context)
            if event.is_set():
                raise EvaluationCancelled()
        except EvaluationCancelled:
            self._finalize_cancelled(evaluation_id, elapsed=time.monotonic() - start_monotonic)
        except EvaluationFailure as exc:
            self._finalize_failed(
                evaluation_id,
                exc.code,
                exc.message,
                detail=exc.message,
                elapsed=time.monotonic() - start_monotonic,
            )
        except Exception as exc:  # isolate all pipeline failures
            self._finalize_failed(
                evaluation_id,
                "EVALUATION_FAILED",
                "The evaluation failed unexpectedly.",
                detail=f"{type(exc).__name__}",
                elapsed=time.monotonic() - start_monotonic,
            )
        else:
            self._finalize_succeeded(
                evaluation_id, outcome, elapsed=time.monotonic() - start_monotonic
            )

    # ------------------------------------------------------------------ finalizers
    def _finalize_succeeded(
        self, evaluation_id: str, outcome: EvaluationOutcome, elapsed: float
    ) -> None:
        row = self._get_row(evaluation_id)
        paths = self._artifact_paths(Path(row.artifact_dir))

        results = {
            "evaluation_id": evaluation_id,
            "model": row.model_id,
            "dataset": row.dataset_id,
            "task": outcome.task,
            "state": SUCCEEDED,
            "classes": outcome.classes,
            "sample_count": outcome.sample_count,
            "evaluation_seconds": outcome.duration_seconds,
            "accuracy": outcome.accuracy,
            "macro_precision": outcome.macro_precision,
            "macro_recall": outcome.macro_recall,
            "macro_f1": outcome.macro_f1,
            "macro": outcome.macro,
            "per_class": outcome.per_class,
            "confusion_matrix": outcome.confusion_matrix,
            "device": outcome.device,
            "completed_at": _utcnow().isoformat(),
            "artifact_dir": self._display_artifact_dir(evaluation_id),
        }
        summary = {
            "evaluation_id": evaluation_id,
            "model": row.model_id,
            "dataset": row.dataset_id,
            "state": SUCCEEDED,
            "accuracy": outcome.accuracy,
            "macro_precision": outcome.macro_precision,
            "macro_recall": outcome.macro_recall,
            "macro_f1": outcome.macro_f1,
            "sample_count": outcome.sample_count,
            "evaluation_seconds": outcome.duration_seconds,
        }
        _write_json_atomic(paths["results"], results)
        _write_json_atomic(paths["metrics"], summary)

        with self._session_factory() as session:
            record = session.get(EvaluationRecord, evaluation_id)
            record.state = SUCCEEDED
            record.progress = 1.0
            record.samples_evaluated = outcome.sample_count
            record.total_samples = outcome.sample_count
            record.accuracy = outcome.accuracy
            record.macro_precision = outcome.macro_precision
            record.macro_recall = outcome.macro_recall
            record.macro_f1 = outcome.macro_f1
            record.elapsed_seconds = elapsed
            record.device = outcome.device
            record.completed_at = _utcnow()
            record.cancel_requested = False
            record.error_code = None
            record.error_message = None
            session.commit()

        self._write_snapshot(evaluation_id)
        self._log(
            evaluation_id,
            f"evaluation succeeded samples={outcome.sample_count} accuracy={outcome.accuracy:.4f}",
        )
        self._finish(evaluation_id)

    def _finalize_failed(
        self, evaluation_id: str, code: str, message: str, detail: str, elapsed: float
    ) -> None:
        row = self._get_row(evaluation_id)
        paths = self._artifact_paths(Path(row.artifact_dir))
        safe_message = self._sanitize(message)
        safe_detail = self._sanitize(detail)

        _write_json_atomic(
            paths["metrics"],
            {
                "evaluation_id": evaluation_id,
                "model": row.model_id,
                "dataset": row.dataset_id,
                "state": FAILED,
                "error": {"code": code, "message": safe_message},
            },
        )
        _write_json_atomic(
            paths["error"], {"code": code, "message": safe_message}
        )

        with self._session_factory() as session:
            record = session.get(EvaluationRecord, evaluation_id)
            record.state = FAILED
            record.progress = 0.0
            record.elapsed_seconds = elapsed
            record.completed_at = _utcnow()
            record.error_code = code
            record.error_message = safe_message
            session.commit()

        self._write_snapshot(evaluation_id)
        self._log(evaluation_id, f"evaluation failed code={code} detail={safe_detail}")
        self._finish(evaluation_id)

    def _finalize_cancelled(self, evaluation_id: str, elapsed: float) -> None:
        row = self._get_row(evaluation_id)
        paths = self._artifact_paths(Path(row.artifact_dir))

        _write_json_atomic(
            paths["metrics"],
            {
                "evaluation_id": evaluation_id,
                "model": row.model_id,
                "dataset": row.dataset_id,
                "state": CANCELLED,
                "sample_count": 0,
                "accuracy": None,
            },
        )

        with self._session_factory() as session:
            record = session.get(EvaluationRecord, evaluation_id)
            record.state = CANCELLED
            record.cancel_requested = True
            record.elapsed_seconds = elapsed
            record.completed_at = _utcnow()
            record.error_code = None
            record.error_message = None
            session.commit()

        self._write_snapshot(evaluation_id)
        self._log(evaluation_id, "evaluation cancelled")
        self._finish(evaluation_id)

    def _finish(self, evaluation_id: str) -> None:
        with self._lock:
            self._live.pop(evaluation_id, None)
            self._last_persist.pop(evaluation_id, None)
            self._cv.notify_all()

    # ------------------------------------------------------------------ persistence
    def _persist_progress(self, evaluation_id: str, done: int, total: int, progress: float) -> None:
        with self._session_factory() as session:
            record = session.get(EvaluationRecord, evaluation_id)
            if record is None or record.state != RUNNING:
                return
            record.samples_evaluated = done
            record.total_samples = total
            record.progress = min(1.0, progress)
            session.commit()

    def _write_snapshot(self, evaluation_id: str) -> None:
        row = self._get_row(evaluation_id)
        _write_json_atomic(
            Path(row.metadata_path),
            {
                "evaluation_id": row.evaluation_id,
                "model": row.model_id,
                "dataset": row.dataset_id,
                "architecture": row.architecture,
                "task": row.task,
                "state": row.state,
                "progress": row.progress,
                "samples_evaluated": row.samples_evaluated,
                "total_samples": row.total_samples,
                "created_at": _iso(row.created_at),
                "started_at": _iso(row.started_at),
                "completed_at": _iso(row.completed_at),
                "elapsed_seconds": row.elapsed_seconds,
                "artifact_dir": self._display_artifact_dir(row.evaluation_id),
                "error": (
                    {"code": row.error_code, "message": row.error_message}
                    if row.error_code
                    else None
                ),
            },
        )

    # -------------------------------------------------------------------- helpers
    def _get_row(self, evaluation_id: str) -> EvaluationRecord:
        with self._session_factory() as session:
            row = session.get(EvaluationRecord, evaluation_id)
            if row is None:
                raise APIError("NOT_FOUND", f"Evaluation '{evaluation_id}' not found", 404)
            session.expunge(row)
            return row

    def _artifact_paths(self, artifact_dir: Path) -> dict[str, Path]:
        return {
            "config": artifact_dir / "config.json",
            "results": artifact_dir / "results.json",
            "metrics": artifact_dir / "metrics.json",
            "metadata": artifact_dir / "evaluation.json",
            "error": artifact_dir / "error.json",
            "log": artifact_dir / "evaluation.log",
        }

    def _validated_artifact_dir(self, evaluation_id: str) -> Path:
        root = self._app_root.resolve()
        candidate = (self._app_root / evaluation_id).resolve()
        if candidate.parent != root:
            raise APIError("INVALID_PATH", "Evaluation directory escapes the artifact root", 400)
        return candidate

    def _display_artifact_dir(self, evaluation_id: str) -> str:
        return f"app/evaluations/{evaluation_id}"

    def _sanitize(self, message: str) -> str:
        text = str(message)
        replacements = {
            str(settings.artifact_root.parent.resolve()): "<project>",
            str(self._artifact_root.parent.resolve()): "<artifact-root>",
        }
        for raw, label in replacements.items():
            if raw and raw in text:
                text = text.replace(raw, label)
        return text[:800]

    def _log(self, evaluation_id: str, message: str) -> None:
        line = f"[{_utcnow().isoformat()}] {self._sanitize(message)}"
        with self._lock:
            self._logs.setdefault(evaluation_id, []).append(line)
            log_path = None
            row = None
        try:
            row = self._get_row(evaluation_id)
            log_path = Path(row.log_path) if row.log_path else None
        except APIError:
            log_path = None
        if log_path is not None:
            try:
                log_path.parent.mkdir(parents=True, exist_ok=True)
                with log_path.open("a", encoding="utf-8") as handle:
                    handle.write(line + "\n")
            except OSError:
                pass

    def _payload(self, row: EvaluationRecord) -> dict:
        with self._lock:
            live = dict(self._live.get(row.evaluation_id, {}))
            queue_position = None
            if row.state == QUEUED and row.evaluation_id in self._queue:
                queue_position = self._queue.index(row.evaluation_id) + 1

        return {
            "evaluation_id": row.evaluation_id,
            "model": row.model_id,
            "dataset": row.dataset_id,
            "architecture": row.architecture,
            "task": row.task,
            "state": row.state,
            "progress": float(live.get("progress", row.progress) or 0.0),
            "samples_evaluated": int(live.get("samples_evaluated", row.samples_evaluated) or 0),
            "total_samples": int(live.get("total_samples", row.total_samples) or 0),
            "metrics": {
                "accuracy": row.accuracy,
                "macro_precision": row.macro_precision,
                "macro_recall": row.macro_recall,
                "macro_f1": row.macro_f1,
            },
            "created_at": row.created_at,
            "started_at": row.started_at,
            "completed_at": row.completed_at,
            "elapsed_seconds": live.get("elapsed_seconds", row.elapsed_seconds),
            "cancel_requested": bool(row.cancel_requested),
            "queue_position": queue_position,
            "device": row.device,
            "artifact_dir": self._display_artifact_dir(row.evaluation_id),
            "source_checkpoint": self._display_path(row.source_checkpoint),
            "results_path": (
                f"{self._display_artifact_dir(row.evaluation_id)}/results.json"
                if row.state == SUCCEEDED
                else None
            ),
            "metrics_path": f"{self._display_artifact_dir(row.evaluation_id)}/metrics.json",
            "metadata_path": f"{self._display_artifact_dir(row.evaluation_id)}/evaluation.json",
            "error": (
                {"code": row.error_code, "message": row.error_message}
                if row.error_code
                else None
            ),
        }

    def _display_path(self, raw: str | None) -> str:
        if not raw:
            return ""
        path = Path(raw).resolve()
        for base in (settings.artifact_root.parent.resolve(), self._artifact_root.parent.resolve()):
            try:
                return path.relative_to(base).as_posix()
            except ValueError:
                continue
        return path.name

    def _recover_locked(self) -> None:
        """Reconcile evaluations interrupted by a backend restart."""
        with self._session_factory() as session:
            rows = session.query(EvaluationRecord).all()
            for row in rows:
                if row.state == RUNNING:
                    row.state = FAILED
                    row.error_code = "RESTART_INTERRUPTED"
                    row.error_message = (
                        "Backend restarted while the evaluation was running. Interrupted "
                        "evaluations cannot be resumed automatically."
                    )
                    row.completed_at = _utcnow()
                    try:
                        _write_json_atomic(
                            Path(row.artifact_dir) / "evaluation.json",
                            {
                                "evaluation_id": row.evaluation_id,
                                "model": row.model_id,
                                "dataset": row.dataset_id,
                                "state": FAILED,
                                "error": {"code": row.error_code, "message": row.error_message},
                            },
                        )
                    except OSError:
                        pass
                elif row.state == QUEUED and row.evaluation_id not in self._queue:
                    self._queue.append(row.evaluation_id)
                    self._cancel_events.setdefault(row.evaluation_id, threading.Event())
            session.commit()


_service: EvaluationJobService | None = None
_service_lock = threading.Lock()


def get_evaluation_service() -> EvaluationJobService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = EvaluationJobService()
    return _service


def reset_evaluation_service() -> None:
    global _service
    with _service_lock:
        if _service is not None:
            _service.stop()
            _service = None
