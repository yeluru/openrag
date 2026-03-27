"""Grounded notes / summaries (reuses retrieval + LLM)."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.note import Note
from app.rag.citations.package import passages_to_citations
from app.rag.prompts.grounded_answer import build_grounded_messages
from app.schemas.scope import ScopePayload
from app.services.generation.llm_openai import get_llm
from app.services.retrieval.pgvector_retriever import retrieve_passages
from app.services.retrieval.scope import RetrievalScope


async def generate_note_assist(
    db: AsyncSession,
    user_id: uuid.UUID,
    sp: ScopePayload,
    *,
    instruction: str,
    title: str | None = None,
    top_k: int = 10,
) -> Note:
    scope = RetrievalScope(
        document_id=sp.document_id,
        section_id=sp.section_id,
        chapter_label=sp.chapter_label,
        section_label=sp.section_label,
        page_start=sp.page_start,
        page_end=sp.page_end,
    )
    # Page-scoped summaries: the instruction often does not embed like the page text, so a strict
    # similarity floor yields zero passages. Take the top passages that overlap the page window.
    page_bounded = sp.page_start is not None or sp.page_end is not None
    min_score = 0.0 if page_bounded else None
    passages, meta = await retrieve_passages(
        db,
        instruction,
        scope,
        top_k=top_k,
        min_score=min_score,
        chapter_id=sp.chapter_id,
    )
    if not passages:
        content = (
            "Insufficient material was retrieved to draft notes. "
            "Try a broader scope or ensure ingestion has completed."
        )
        cites: list = []
    else:
        llm = get_llm()
        section_scope = bool(sp.section_id or sp.chapter_id)
        msgs = build_grounded_messages(
            instruction,
            passages,
            mode="concise_summary",
            insufficient_evidence=meta.insufficient_evidence,
            section_scope=section_scope,
        )
        content = await llm.complete(msgs, temperature=0.25)
        cites = [c.model_dump(mode="json") for c in passages_to_citations(passages)]

    note = Note(
        user_id=user_id,
        document_id=sp.document_id,
        section_id=sp.section_id,
        title=title,
        content=content,
        ai_generated=True,
        citations=cites,
    )
    db.add(note)
    await db.flush()
    return note
