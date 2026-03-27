"""End-to-end document ingestion: parse → structure → chunk → embed → persist."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models.chunk import Chunk
from app.db.models.document import Document
from app.db.models.enums import IngestionStatus
from app.db.models.ingestion import IngestionJob
from app.db.models.section import DocumentSection
from app.rag.chunkers.structure_aware import build_chunks_from_structure
from app.services.embeddings.factory import get_embedding_provider
from app.services.documents.document_service import resolve_stored_upload_path
from app.services.ingestion.structure_extractor import InferredSection, extract_structure
from app.services.parsing.base import DocumentParser
from app.services.parsing.registry import resolve_parser_for_document
from app.utils.text import normalize_whitespace

logger = logging.getLogger(__name__)


async def _set_job(
    db: AsyncSession,
    job_id: UUID,
    status: IngestionStatus,
    *,
    error_message: str | None = None,
    error_detail: dict | None = None,
    progress: dict | None = None,
) -> None:
    job = await db.get(IngestionJob, job_id)
    if not job:
        return
    job.status = status
    if error_message is not None:
        job.error_message = error_message
    if error_detail is not None:
        job.error_detail = error_detail
    if progress is not None:
        job.progress_meta = {**job.progress_meta, **progress}
    await db.flush()


async def _persist_sections(
    db: AsyncSession,
    document_id: UUID,
    inferred: list[InferredSection],
) -> dict[int, UUID]:
    """Map inferred list index → persisted section UUID."""
    id_map: dict[int, UUID] = {}
    for i, sec in enumerate(inferred):
        parent_uuid = id_map[sec.parent_index] if sec.parent_index is not None else None
        row = DocumentSection(
            document_id=document_id,
            parent_id=parent_uuid,
            kind=sec.kind,
            label=sec.label[:1024],
            order_index=sec.order_index,
            depth=sec.depth,
            page_start=sec.page_start,
            page_end=sec.page_end,
        )
        db.add(row)
        await db.flush()
        id_map[i] = row.id
    return id_map


async def run_ingestion(
    db: AsyncSession,
    document_id: UUID,
    job_id: UUID,
    *,
    parser: DocumentParser | None = None,
) -> None:
    doc = await db.get(Document, document_id)
    if not doc:
        await _set_job(
            db,
            job_id,
            IngestionStatus.failed,
            error_message="Document not found",
        )
        await db.commit()
        return

    path = resolve_stored_upload_path(doc.storage_path)
    if path is None:
        await _set_job(
            db,
            job_id,
            IngestionStatus.failed,
            error_message="Original upload file not found on disk",
        )
        await db.commit()
        return

    mime_type_stored = doc.mime_type
    original_filename_stored = doc.original_filename

    try:
        await _set_job(db, job_id, IngestionStatus.parsing)
        await db.commit()

        try:
            active = parser or resolve_parser_for_document(
                mime_type=mime_type_stored,
                original_filename=original_filename_stored,
            )
        except LookupError as e:
            await _set_job(
                db,
                job_id,
                IngestionStatus.failed,
                error_message=str(e),
                error_detail={"type": "LookupError"},
            )
            await db.commit()
            return

        parsed = active.parse(str(path))
        doc = await db.get(Document, document_id)
        if not doc:
            raise RuntimeError("Document disappeared during ingestion")
        doc.page_count = len(parsed.pages)
        if parsed.raw_metadata.get("title"):
            doc.title = (parsed.raw_metadata["title"] or doc.title)[:512]
        if parsed.raw_metadata.get("author"):
            doc.author_inferred = (parsed.raw_metadata["author"] or "")[:512]
        extra = {
            **(doc.extra_metadata or {}),
            "parser": parsed.parser_name,
            "parser_version": parsed.parser_version,
            "parser_limitations": parsed.limitations,
        }
        if ocr_pages := parsed.raw_metadata.get("ocr_pages"):
            extra["ocr_pages"] = ocr_pages
        doc.extra_metadata = extra
        await _set_job(db, job_id, IngestionStatus.structure_extracting)
        await db.commit()

        inferred = extract_structure(parsed)
        await db.execute(delete(Chunk).where(Chunk.document_id == document_id))
        await db.execute(delete(DocumentSection).where(DocumentSection.document_id == document_id))
        await db.flush()

        id_map = await _persist_sections(db, document_id, inferred)

        await _set_job(db, job_id, IngestionStatus.chunking)
        await db.commit()

        drafts = build_chunks_from_structure(inferred)
        chunk_rows: list[Chunk] = []
        for d in drafts:
            sid = id_map.get(d.inferred_section_index)
            chunk_rows.append(
                Chunk(
                    document_id=document_id,
                    section_id=sid,
                    chapter_label=d.chapter_label,
                    section_label=d.section_label,
                    chunk_index=d.chunk_index,
                    page_start=d.page_start,
                    page_end=d.page_end,
                    source_text=d.text,
                    normalized_text=d.normalized_text,
                    token_count_estimate=d.token_count_estimate,
                )
            )
        db.add_all(chunk_rows)
        await db.flush()

        await _set_job(
            db,
            job_id,
            IngestionStatus.embedding,
            progress={"chunks": len(chunk_rows)},
        )
        await db.commit()

        res = await db.execute(
            select(Chunk)
            .where(Chunk.document_id == document_id)
            .order_by(Chunk.chunk_index)
        )
        stored_chunks = list(res.scalars().all())
        provider = get_embedding_provider()
        texts = [normalize_whitespace(c.normalized_text) for c in stored_chunks]
        vectors = await provider.embed_texts(texts)
        if len(vectors) != len(stored_chunks):
            raise RuntimeError("Embedding count mismatch")
        for c, v in zip(stored_chunks, vectors, strict=True):
            c.embedding = v

        await _set_job(db, job_id, IngestionStatus.indexing)
        await db.commit()

        await _set_job(db, job_id, IngestionStatus.ready, progress={"embedded": len(stored_chunks)})
        s = get_settings()
        doc = await db.get(Document, document_id)
        if doc:
            doc.extra_metadata = {
                **(doc.extra_metadata or {}),
                "embedding_provider": s.embedding_provider,
                "embedding_model": s.embedding_model,
                "embedding_dimensions": s.embedding_dimensions,
            }
        await db.commit()
        logger.info("Ingestion complete document_id=%s chunks=%s", document_id, len(stored_chunks))
    except Exception as e:
        logger.exception("Ingestion failed document_id=%s", document_id)
        await db.rollback()
        try:
            await _set_job(
                db,
                job_id,
                IngestionStatus.failed,
                error_message=str(e),
                error_detail={"type": type(e).__name__},
            )
            await db.commit()
        except Exception:
            logger.exception("Failed to persist ingestion failure state job_id=%s", job_id)
