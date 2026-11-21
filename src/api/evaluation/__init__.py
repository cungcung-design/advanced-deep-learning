"""Background model evaluation package."""
from __future__ import annotations

from .catalog import presets
from .service import EvaluationJobService, get_evaluation_service, reset_evaluation_service

__all__ = [
    "EvaluationJobService",
    "get_evaluation_service",
    "reset_evaluation_service",
    "presets",
]
