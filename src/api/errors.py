"""Consistent API error handling."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def error_payload(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def api_error_handler(_: Request, exc: APIError):
        return JSONResponse(status_code=exc.status_code, content=error_payload(exc.code, exc.message, exc.details))

    @app.exception_handler(HTTPException)
    async def http_error_handler(_: Request, exc: HTTPException):
        code = {404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR"}.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(status_code=exc.status_code, content=error_payload(code, str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError):
        errors = [{key: value for key, value in error.items() if key != "ctx"} for error in exc.errors()]
        return JSONResponse(status_code=422, content=error_payload("VALIDATION_ERROR", "Request validation failed", {"errors": errors}))
