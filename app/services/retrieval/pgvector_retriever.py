"""Semantic retrieval over pgvector with scope filters and deduplication."""

from __future__ import annotations

import time
from uuid import UUID

from sqlalchemy import Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models.chunk import Chunk
from app.db.models.section import DocumentSection
from app.rag.retrievers.schemas import RetrievedPassage, RetrievalMeta
from app.services.embeddings.factory import get_embedding_provider
from app.services.retrieval.scope import RetrievalScope
from app.utils.text import normalize_whitespace


async def _section_ids_under(db: AsyncSession, document_id: UUID, root_id: UUID) -> list[UUID]:
    """Section id + all descendants for a document (small trees; one query)."""
    res = await db.execute(
        select(DocumentSection).where(DocumentSection.document_id == document_id)
    )
    rows = res.scalars().all()
    by_parent: dict[UUID | None, list[UUID]] = {}
    for s in rows:
        by_parent.setdefault(s.parent_id, []).append(s.id)

    out: list[UUID] = []

    def dfs(nid: UUID) -> None:
        out.append(nid)
        for c in by_parent.get(nid, []):
            dfs(c)

    dfs(root_id)
    return out


def _dedupe_passages(
    passages: list[RetrievedPassage],
    overlap_ratio: float,
) -> list[RetrievedPassage]:
    kept: list[RetrievedPassage] = []
    for p in passages:
        dup = False
        pn = normalize_whitespace(p.text)
        for k in kept:
            kn = normalize_whitespace(k.text)
            shorter, longer = (pn, kn) if len(pn) <= len(kn) else (kn, pn)
            if not shorter:
                continue
            if shorter in longer and len(shorter) / max(len(longer), 1) >= overlap_ratio:
                dup = True
                break
        if not dup:
            kept.append(p)
    return kept


def _apply_scope(stmt: Select, scope: RetrievalScope) -> Select:
    stmt = stmt.where(Chunk.document_id == scope.document_id)
    # section_id: applied in retrieve_passages via subtree (chunks attach to leaf sections only).
    if scope.chapter_label:
        stmt = stmt.where(Chunk.chapter_label == scope.chapter_label)
    if scope.section_label:
        stmt = stmt.where(Chunk.section_label == scope.section_label)
    if scope.page_start is not None and scope.page_end is not None:
        stmt = stmt.where(
            and_(
                Chunk.page_start <= scope.page_end,
                or_(Chunk.page_end.is_(None), Chunk.page_end >= scope.page_start),
            )
        )
    elif scope.page_start is not None:
        stmt = stmt.where(
            or_(Chunk.page_end.is_(None), Chunk.page_end >= scope.page_start)
        )
    elif scope.page_end is not None:
        stmt = stmt.where(Chunk.page_start <= scope.page_end)
    return stmt


async def retrieve_passages(
    db: AsyncSession,
    query: str,
    scope: RetrievalScope,
    *,
    top_k: int | None = None,
    min_score: float | None = None,
    dedupe: bool = True,
    chapter_id: UUID | None = None,
) -> tuple[list[RetrievedPassage], RetrievalMeta]:
    settings = get_settings()
    k = top_k or settings.retrieval_default_top_k
    threshold = min_score if min_score is not None else settings.retrieval_min_score_cosine

    t0 = time.perf_counter()
    provider = get_embedding_provider()
    qvec = await provider.embed_query(query)

    distance = Chunk.embedding.cosine_distance(qvec)
    subtree_root: UUID | None = chapter_id or scope.section_id
    prefetch = max(k * 4, 32)
    if subtree_root:
        prefetch = max(k * 6, 48)

    stmt = (
        select(Chunk, distance.label("distance"))
        .where(Chunk.embedding.isnot(None))
        .order_by(distance)
        .limit(prefetch)
    )
    stmt = _apply_scope(stmt, scope)

    if subtree_root:
        sec_ids = await _section_ids_under(db, scope.document_id, subtree_root)
        stmt = stmt.where(Chunk.section_id.in_(sec_ids))

    result = await db.execute(stmt)
    rows = result.all()

    passages: list[RetrievedPassage] = []
    debug_rows: list[dict] = []
    for row in rows:
        chunk: Chunk = row[0]
        dist = float(row[1])
        sim = max(0.0, min(1.0, 1.0 - dist))
        if sim < threshold:
            continue
        passages.append(
            RetrievedPassage(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                score=round(sim, 6),
                text=chunk.source_text,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                chapter_label=chunk.chapter_label,
                section_label=chunk.section_label,
                section_id=chunk.section_id,
                chunk_index=chunk.chunk_index,
            )
        )
        if settings.include_retrieval_debug or settings.debug:
            debug_rows.append({"chunk_id": str(chunk.id), "distance": dist, "sim": sim})

    if dedupe:
        passages = _dedupe_passages(passages, settings.retrieval_dedupe_overlap_ratio)

    passages = passages[:k]
    elapsed_ms = (time.perf_counter() - t0) * 1000

    # Relaxed pass (min_score=0): caller wants top-k regardless of similarity—do not mark insufficient
    # only because scores are numerically low (e.g. mixed embedding spaces until re-ingest).
    relaxed = min_score is not None and min_score <= 0.0
    best = passages[0].score if passages else 0.0
    if relaxed:
        insufficient = len(passages) == 0
    else:
        # Chunks above `threshold` are already usable; flag only when coverage is thin.
        insufficient = len(passages) == 0 or (
            len(passages) < 2 and best < threshold + 0.02
        )

    meta = RetrievalMeta(
        top_k=k,
        used_scope_filters=scope.has_filters() or chapter_id is not None,
        insufficient_evidence=insufficient,
        min_score_threshold=threshold,
        timing_ms=round(elapsed_ms, 2),
        debug={"rows": debug_rows[:20]} if (settings.include_retrieval_debug or settings.debug) else None,
    )
    return passages, meta
