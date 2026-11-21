"""Application configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _path_env(name: str, default: Path) -> Path:
    return Path(os.getenv(name, str(default))).resolve()


@dataclass(frozen=True)
class Settings:
    app_name: str = "DeepVision AI Studio"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    database_url: str = field(default_factory=lambda: os.getenv("DEEPVISION_DATABASE_URL", f"sqlite:///{(PROJECT_ROOT / 'deepvision.db').as_posix()}"))
    artifact_root: Path = field(default_factory=lambda: _path_env("DEEPVISION_ARTIFACT_ROOT", PROJECT_ROOT / "artifacts"))
    data_root: Path = field(default_factory=lambda: _path_env("DEEPVISION_DATA_ROOT", PROJECT_ROOT / "data"))
    config_root: Path = field(default_factory=lambda: _path_env("DEEPVISION_CONFIG_ROOT", PROJECT_ROOT / "configs"))
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in os.getenv("DEEPVISION_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        )
    )

    @property
    def allowed_roots(self) -> tuple[Path, ...]:
        return (self.artifact_root, self.data_root, self.config_root)


settings = Settings()
