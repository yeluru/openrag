"""Notes assist API response."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class NoteAssistResponse(BaseModel):
    note_id: UUID
    title: str | None = None
    content: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    ai_generated: bool
