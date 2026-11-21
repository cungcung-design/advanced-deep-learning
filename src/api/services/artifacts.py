"""Safe artifact path resolution and discovery."""
from __future__ import annotations

from pathlib import Path

from ..config import settings
from ..errors import APIError


def resolve_allowed_path(raw_path: str | Path) -> Path:
    """Resolve a path and ensure it stays inside an approved storage root."""
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = settings.artifact_root.parent / candidate
    resolved = candidate.resolve()
    if not any(resolved == root or root in resolved.parents for root in settings.allowed_roots):
        raise APIError("INVALID_PATH", "Path is outside approved storage roots", 400)
    return resolved


def safe_stat(path: Path) -> dict:
    try:
        stat = path.stat()
        return {"exists": True, "size_bytes": stat.st_size}
    except OSError:
        return {"exists": False, "size_bytes": None}


def load_json_file(path: Path) -> dict:
    import json

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise APIError("INVALID_METADATA", "Metadata file is missing or corrupted", 500, {"file": path.name}) from exc


def directory_usage(root: Path) -> tuple[int, int]:
    total_bytes, files = 0, 0
    if not root.exists():
        return 0, 0
    for p in root.rglob("*"):
        if p.is_file():
            files += 1
            try:
                total_bytes += p.stat().st_size
            except OSError:
                continue
    return total_bytes, files
