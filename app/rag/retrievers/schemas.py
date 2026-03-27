"""Structured retrieval results (ranking preserved)."""

from uuid import UUID

from pydantic import BaseModel, Field


class RetrievedPassage(BaseModel):
    chunk_id: UUID
    document_id: UUID
    score: float = Field(description="Similarity 0–1 (cosine similarity)")
    text: str
    page_start: int | None = None
    page_end: int | None = None
    chapter_label: str | None = None
    section_label: str | None = None
    section_id: UUID | None = None
    chunk_index: int | None = None


class RetrievalMeta(BaseModel):
    top_k: int
    used_scope_filters: bool
    insufficient_evidence: bool
    min_score_threshold: float | None = None
    timing_ms: float | None = None
    debug: dict | None = None
