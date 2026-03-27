"""Stitched text for a section subtree (leaf chunks in reading order)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chunk import Chunk
from app.db.models.document import Document
from app.db.models.section import DocumentSection
from app.services.retrieval.pgvector_retriever import _section_ids_under

MAX_CHUNKS = 450


@dataclass
class ReadthroughPiece:
    chunk_id: UUID
    text: str
    page_start: int | None
    page_end: int | None
    chapter_label: str | None
    section_label: str | None


async def fetch_section_readthrough(
    db: AsyncSession,
    *,
    user_id: UUID,
    document_id: UUID,
    section_id: UUID,
) -> tuple[list[ReadthroughPiece], str | None] | None:
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        return None
    sec = await db.get(DocumentSection, section_id)
    if not sec or sec.document_id != document_id:
        return None

    sec_ids = await _section_ids_under(db, document_id, section_id)
    res = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .where(Chunk.section_id.in_(sec_ids))
        .order_by(Chunk.chunk_index)
        .limit(MAX_CHUNKS)
    )
    rows = list(res.scalars().all())
    pieces = [
        ReadthroughPiece(
            chunk_id=c.id,
            text=c.source_text or "",
            page_start=c.page_start,
            page_end=c.page_end,
            chapter_label=c.chapter_label,
            section_label=c.section_label,
        )
        for c in rows
    ]
    return pieces, sec.label


async def fetch_full_document_readthrough(
    db: AsyncSession,
    *,
    user_id: UUID,
    document_id: UUID,
) -> list[ReadthroughPiece] | None:
    """All chunks for a document in reading order (cap for safety)."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        return None
    res = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
        .limit(MAX_CHUNKS)
    )
    rows = list(res.scalars().all())
    return [
        ReadthroughPiece(
            chunk_id=c.id,
            text=c.source_text or "",
            page_start=c.page_start,
            page_end=c.page_end,
            chapter_label=c.chapter_label,
            section_label=c.section_label,
        )
        for c in rows
    ]
