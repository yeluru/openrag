"""Retrieval-grounded flashcard generation."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.document import Document
from app.db.models.enums import Difficulty
from app.db.models.flashcard import Flashcard
from app.schemas.scope import ScopePayload
from app.services.generation.llm_openai import get_llm
from app.services.retrieval.pgvector_retriever import retrieve_passages
from app.services.retrieval.scope import RetrievalScope


async def generate_flashcards(
    db: AsyncSession,
    user_id: uuid.UUID,
    sp: ScopePayload,
    *,
    topic: str | None,
    count: int = 10,
) -> list[Flashcard]:
    doc = await db.get(Document, sp.document_id)
    if not doc:
        raise ValueError("Document not found")

    q = topic or "Key terms, definitions, and concepts worth memorizing."
    scope = RetrievalScope(
        document_id=sp.document_id,
        section_id=sp.section_id,
        chapter_label=sp.chapter_label,
        section_label=sp.section_label,
        page_start=sp.page_start,
        page_end=sp.page_end,
    )
    passages, _ = await retrieve_passages(
        db,
        q,
        scope,
        top_k=min(30, count * 4),
        min_score=0.0,
        chapter_id=sp.chapter_id,
    )
    if not passages:
        raise ValueError("No retrieved passages in scope.")

    ctx = "\n\n---\n\n".join(f"[chunk_id={p.chunk_id}]\n{p.text}" for p in passages)
    sys = """Output ONLY JSON: {"cards":[{"front":str,"back":str,"difficulty":"beginner"|"intermediate"|"advanced"|null,"supporting_chunk_ids":[str]}]}.
Cards must be fully supported by SOURCE_PASSAGES only."""
    user = f"COUNT: {count}\n\nSOURCE_PASSAGES:\n{ctx}"
    llm = get_llm()
    raw = await llm.complete(
        [{"role": "system", "content": sys}, {"role": "user", "content": user}],
        temperature=0.35,
        response_format_json=True,
    )
    data: dict[str, Any] = json.loads(raw)
    cards = data.get("cards") or []
    passage_by_id = {str(p.chunk_id): p for p in passages}

    out: list[Flashcard] = []
    for it in cards[:count]:
        sup = it.get("supporting_chunk_ids") or []
        cites = []
        sps = []
        for sid in sup:
            p = passage_by_id.get(str(sid))
            if not p:
                continue
            cites.append(
                {
                    "chunk_id": str(p.chunk_id),
                    "page_start": p.page_start,
                    "page_end": p.page_end,
                }
            )
            sps.append(
                {
                    "chunk_id": str(p.chunk_id),
                    "score": p.score,
                    "text": p.text,
                    "page_start": p.page_start,
                    "page_end": p.page_end,
                }
            )
        if not cites and passages:
            p0 = passages[0]
            cites = [{"chunk_id": str(p0.chunk_id), "page_start": p0.page_start}]
            sps = [
                {
                    "chunk_id": str(p0.chunk_id),
                    "score": p0.score,
                    "text": p0.text,
                    "page_start": p0.page_start,
                    "page_end": p0.page_end,
                }
            ]
        diff_raw = it.get("difficulty")
        diff = None
        if diff_raw:
            try:
                diff = Difficulty(str(diff_raw).lower())
            except ValueError:
                diff = None
        fc = Flashcard(
            user_id=user_id,
            document_id=sp.document_id,
            section_id=sp.section_id,
            front=it.get("front") or "",
            back=it.get("back") or "",
            difficulty=diff,
            citations=cites,
            source_passages=sps,
            ai_generated=True,
        )
        db.add(fc)
        out.append(fc)
    await db.flush()
    return out
