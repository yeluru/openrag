"""Flashcard generation / patch API responses."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class FlashcardItemOut(BaseModel):
    id: UUID
    front: str
    back: str
    difficulty: str | None = None
    citations: list[dict[str, Any]] = Field(default_factory=list)
    source_passages: list[dict[str, Any]] = Field(default_factory=list)
    ai_generated: bool


class FlashcardGenerateResponse(BaseModel):
    flashcards: list[FlashcardItemOut]


class FlashcardPatchResponse(BaseModel):
    id: UUID
    front: str
    back: str
