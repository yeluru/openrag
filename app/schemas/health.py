"""Health check response."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app: str
    database: bool
    debug: bool
