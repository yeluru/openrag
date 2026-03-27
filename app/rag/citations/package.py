"""Map retrieval results to API citation objects."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.rag.retrievers.schemas import RetrievedPassage


class CitationPayload(BaseModel):
    chunk_id: UUID
    document_id: UUID
    page_start: int | None = None
    page_end: int | None = None
    chapter_label: str | None = None
    section_label: str | None = None
    snippet: str = Field(description="Short excerpt for UI")


def _snippet(text: str, max_len: int = 280) -> str:
    t = " ".join(text.split())
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def passages_to_citations(passages: list[RetrievedPassage]) -> list[CitationPayload]:
    out: list[CitationPayload] = []
    for p in passages:
        out.append(
            CitationPayload(
                chunk_id=p.chunk_id,
                document_id=p.document_id,
                page_start=p.page_start,
                page_end=p.page_end,
                chapter_label=p.chapter_label,
                section_label=p.section_label,
                snippet=_snippet(p.text),
            )
        )
    return out
