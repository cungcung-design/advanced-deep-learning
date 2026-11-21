"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .errors import register_error_handlers
from .evaluation.service import get_evaluation_service
from .routers import datasets, evaluations, health, inference, registry, settings as settings_router, training
from .training.service import get_training_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    get_training_service().start()
    get_evaluation_service().start()
    try:
        yield
    finally:
        get_evaluation_service().stop()
        get_training_service().stop()


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

app.include_router(health.router)
app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(settings_router.router, prefix=settings.api_prefix)
app.include_router(registry.router, prefix=settings.api_prefix)
app.include_router(datasets.router, prefix=settings.api_prefix)
app.include_router(training.router, prefix=settings.api_prefix)
app.include_router(evaluations.router, prefix=settings.api_prefix)
app.include_router(inference.router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict:
    return {"app": settings.app_name, "version": settings.version, "docs": "/docs", "api": settings.api_prefix}
