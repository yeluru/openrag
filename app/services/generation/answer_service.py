"""Grounded answers with mandatory citations from retrieval."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.prompts.grounded_answer import build_grounded_messages
from app.rag.retrievers.schemas import RetrievedPassage, RetrievalMeta
from app.schemas.grounded import GroundedAnswerResponse, from_passages
from app.schemas.scope import ScopePayload
from app.core.config import get_settings
from app.services.generation.llm_openai import get_llm
from app.services.retrieval.outline_hints import (
    build_document_outline_text,
    question_asks_document_outline,
)
from app.services.retrieval.pgvector_retriever import retrieve_passages
from app.services.retrieval.scope import RetrievalScope


async def generate_grounded_answer(
    db: AsyncSession,
    question: str,
    scope_payload: ScopePayload,
    *,
    mode: str = "beginner_explanation",
    top_k: int | None = None,
) -> GroundedAnswerResponse:
    section_scope = bool(scope_payload.section_id or scope_payload.chapter_id)
    document_outline: str | None = None
    if question_asks_document_outline(question):
        document_outline = await build_document_outline_text(db, scope_payload.document_id)

    scope = RetrievalScope(
        document_id=scope_payload.document_id,
        section_id=scope_payload.section_id,
        chapter_label=scope_payload.chapter_label,
        section_label=scope_payload.section_label,
        page_start=scope_payload.page_start,
        page_end=scope_payload.page_end,
    )
    passages, meta = await retrieve_passages(
        db,
        question,
        scope,
        top_k=top_k,
        chapter_id=scope_payload.chapter_id,
    )

    if not passages:
        weak_passages, weak_meta = await retrieve_passages(
            db,
            question,
            scope,
            top_k=max(8, (top_k or 5) * 2),
            min_score=0.0,
            chapter_id=scope_payload.chapter_id,
        )
        meta = RetrievalMeta(
            top_k=weak_meta.top_k,
            used_scope_filters=weak_meta.used_scope_filters,
            insufficient_evidence=weak_meta.insufficient_evidence,
            min_score_threshold=weak_meta.min_score_threshold,
            timing_ms=weak_meta.timing_ms,
            debug=weak_meta.debug,
        )
        if not weak_passages:
            if document_outline:
                llm = get_llm()
                messages = build_grounded_messages(
                    question,
                    [],
                    mode=mode,
                    insufficient_evidence=False,
                    document_outline=document_outline,
                    section_scope=section_scope,
                )
                answer_text = await llm.complete(messages)
                return from_passages(
                    answer_text,
                    mode,
                    _scope_dict(scope_payload),
                    [],
                    meta,
                )
            answer = (
                "I could not find any passages in this document that relate to your question. "
                "Try rephrasing, widening scope, or confirming ingestion finished successfully."
            )
            return from_passages(
                answer,
                mode,
                _scope_dict(scope_payload),
                [],
                meta,
            )
        # Semantic scores can be misleading (e.g. chunks embedded with a different provider than the query).
        llm = get_llm()
        settings = get_settings()
        best_sim = max((p.score for p in weak_passages), default=0.0)
        low_sim = best_sim < settings.retrieval_min_score_cosine
        messages = build_grounded_messages(
            question,
            weak_passages,
            mode=mode,
            insufficient_evidence=low_sim,
            document_outline=document_outline,
            section_scope=section_scope,
        )
        answer_text = await llm.complete(messages)
        prefix = (
            "Retrieval confidence was low (embedding match weak). Answer is based only on the excerpts below—verify in the source. "
            if low_sim
            else ""
        )
        return from_passages(
            prefix + answer_text,
            mode,
            _scope_dict(scope_payload),
            weak_passages,
            meta,
        )

    llm = get_llm()
    messages = build_grounded_messages(
        question,
        passages,
        mode=mode,
        insufficient_evidence=meta.insufficient_evidence,
        document_outline=document_outline,
        section_scope=section_scope,
    )
    answer_text = await llm.complete(messages)

    if meta.insufficient_evidence:
        prefix = (
            "Evidence in the retrieved passages is limited; answer cautiously and verify in the book. "
        )
        answer_text = prefix + answer_text

    return from_passages(
        answer_text,
        mode,
        _scope_dict(scope_payload),
        passages,
        meta,
    )


def _scope_dict(sp: ScopePayload) -> dict:
    return {
        "document_id": str(sp.document_id),
        "chapter_id": str(sp.chapter_id) if sp.chapter_id else None,
        "section_id": str(sp.section_id) if sp.section_id else None,
    }
