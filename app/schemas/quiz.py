"""OpenAPI-stable quiz API response models."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class QuizQuestionGenerateOut(BaseModel):
    """Question row returned immediately after generation (includes answers for study UI)."""

    id: UUID
    question_type: str
    question_text: str
    options: list[Any] | dict[str, Any] | None = None
    correct_answer: str
    explanation: str | None = None
    citations: list[dict[str, Any]] = Field(default_factory=list)
    source_passages: list[dict[str, Any]] = Field(default_factory=list)
    order_index: int


class QuizGenerateResponse(BaseModel):
    quiz_id: UUID
    title: str
    difficulty: str
    questions: list[QuizQuestionGenerateOut]


class QuizQuestionGetOut(BaseModel):
    """Single question on quiz fetch; answer fields omitted when include_answers=false."""

    id: UUID
    question_type: str
    question_text: str
    options: list[Any] | dict[str, Any] | None = None
    order_index: int
    citations: list[dict[str, Any]] = Field(default_factory=list)
    correct_answer: str | None = None
    explanation: str | None = None
    source_passages: list[dict[str, Any]] | None = None


class QuizDetailResponse(BaseModel):
    quiz_id: UUID
    title: str
    difficulty: str
    scope: dict[str, Any] = Field(default_factory=dict)
    questions: list[QuizQuestionGetOut]


class QuizAttemptSubmitResponse(BaseModel):
    attempt_id: UUID
    score: float
    score_fraction: float
    per_question: dict[str, bool | None]


class QuizAttemptSummaryOut(BaseModel):
    attempt_id: UUID
    score: float | None
    answers: dict[str, Any]
    created_at: datetime
