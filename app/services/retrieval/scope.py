"""Scope filters for retrieval and generation."""

from uuid import UUID

from pydantic import BaseModel, Field


class RetrievalScope(BaseModel):
    document_id: UUID
    chapter_id: UUID | None = None
    section_id: UUID | None = None
    chapter_label: str | None = None
    section_label: str | None = None
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)

    def has_filters(self) -> bool:
        return any(
            [
                self.chapter_id,
                self.section_id,
                self.chapter_label,
                self.section_label,
                self.page_start is not None,
                self.page_end is not None,
            ]
        )
