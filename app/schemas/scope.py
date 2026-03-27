"""API scope models (mirror service layer)."""

from uuid import UUID

from pydantic import BaseModel, Field


class ScopePayload(BaseModel):
    document_id: UUID
    chapter_id: UUID | None = None
    section_id: UUID | None = None
    chapter_label: str | None = None
    section_label: str | None = None
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
