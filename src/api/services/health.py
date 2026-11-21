"""Health and readiness checks."""
from __future__ import annotations

import os
from pathlib import Path

from ..config import settings
from ..db import SessionLocal, database_ready


def check_artifact_root() -> tuple[bool, bool]:
    root = Path(settings.artifact_root)
    exists = root.exists() and root.is_dir()
    writable = False
    if exists:
        try:
            probe = root / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
            writable = True
        except OSError:
            writable = False
    return exists, writable


def readiness() -> dict:
    session = SessionLocal()
    try:
        db_ok = database_ready(session)
    finally:
        session.close()
    exists, writable = check_artifact_root()
    status = "ready" if db_ok and exists and writable else "not_ready"
    return {
        "status": status,
        "database": db_ok,
        "artifact_root": exists,
        "artifact_root_writable": writable,
    }
