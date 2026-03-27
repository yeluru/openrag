"""Semantic search API response (wraps retrieval + citation packages)."""

from __future__ import annotations

from pydantic import BaseModel

from app.rag.citations.package import CitationPayload
from app.rag.retrievers.schemas import RetrievedPassage, RetrievalMeta


class SemanticSearchResponse(BaseModel):
    results: list[RetrievedPassage]
    citations: list[CitationPayload]
    retrieval_meta: RetrievalMeta
