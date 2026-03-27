"""Grounded generation response shapes (trust + citations)."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.rag.citations.package import CitationPayload, passages_to_citations
from app.rag.retrievers.schemas import RetrievedPassage, RetrievalMeta


class SourcePassageOut(BaseModel):
    chunk_id: UUID
    score: float
    text: str
    page_start: int | None = None
    page_end: int | None = None
    chapter_label: str | None = None
    section_label: str | None = None


class GroundedAnswerResponse(BaseModel):
    answer: str
    mode: str
    scope: dict
    citations: list[CitationPayload]
    source_passages: list[SourcePassageOut]
    retrieval_meta: RetrievalMeta


def from_passages(
    answer: str,
    mode: str,
    scope: dict,
    passages: list[RetrievedPassage],
    meta: RetrievalMeta,
) -> GroundedAnswerResponse:
    cites = passages_to_citations(passages)
    sp = [
        SourcePassageOut(
            chunk_id=p.chunk_id,
            score=p.score,
            text=p.text,
            page_start=p.page_start,
            page_end=p.page_end,
            chapter_label=p.chapter_label,
            section_label=p.section_label,
        )
        for p in passages
    ]
    return GroundedAnswerResponse(
        answer=answer,
        mode=mode,
        scope=scope,
        citations=cites,
        source_passages=sp,
        retrieval_meta=meta,
    )
