"""Retrieval-grounded quiz generation."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.document import Document
from app.db.models.enums import Difficulty, QuizQuestionType
from app.db.models.quiz import Quiz, QuizQuestion
from app.schemas.scope import ScopePayload
from app.services.generation.llm_openai import get_llm
from app.services.retrieval.pgvector_retriever import retrieve_passages
from app.services.retrieval.scope import RetrievalScope


def _scope_to_retrieval(sp: ScopePayload) -> RetrievalScope:
    return RetrievalScope(
        document_id=sp.document_id,
        section_id=sp.section_id,
        chapter_label=sp.chapter_label,
        section_label=sp.section_label,
        page_start=sp.page_start,
        page_end=sp.page_end,
    )


async def generate_quiz(
    db: AsyncSession,
    user_id: uuid.UUID,
    sp: ScopePayload,
    *,
    topic: str | None,
    difficulty: Difficulty,
    num_questions: int = 5,
    question_types: list[QuizQuestionType] | None = None,
) -> Quiz:
    doc = await db.get(Document, sp.document_id)
    if not doc:
        raise ValueError("Document not found")

    qtext = topic or "Important concepts, definitions, and factual claims suitable for study."
    scope = _scope_to_retrieval(sp)
    passages, _meta = await retrieve_passages(
        db,
        qtext,
        scope,
        top_k=min(24, num_questions * 5),
        min_score=0.0,
        chapter_id=sp.chapter_id,
    )
    if not passages:
        raise ValueError("No retrieved passages in scope; widen scope or finish ingestion.")

    allowed_types = question_types or [
        QuizQuestionType.multiple_choice,
        QuizQuestionType.true_false,
        QuizQuestionType.short_answer,
    ]
    type_names = [t.value for t in allowed_types]

    ctx_lines = []
    for p in passages:
        ctx_lines.append(f"[chunk_id={p.chunk_id}]\n{p.text}")
    context_block = "\n\n---\n\n".join(ctx_lines)

    sys = """You output ONLY valid JSON. Build a quiz strictly from SOURCE PASSAGES.
Each question must be answerable from the text. Include supporting_chunk_ids listing chunk UUIDs you used.
Schema: {"questions":[{"question_text":str,"question_type":one of allowed,"options":list[str]|null,"correct_answer":str,"explanation":str,"supporting_chunk_ids":[str,...]}]}"""

    user = f"""DIFFICULTY: {difficulty.value}
COUNT: {num_questions}
ALLOWED_TYPES: {type_names}

SOURCE_PASSAGES:
{context_block}
"""

    llm = get_llm()
    raw = await llm.complete(
        [{"role": "system", "content": sys}, {"role": "user", "content": user}],
        temperature=0.3,
        response_format_json=True,
    )
    data: dict[str, Any] = json.loads(raw)
    items = data.get("questions") or []

    quiz = Quiz(
        user_id=user_id,
        document_id=sp.document_id,
        title=f"Quiz: {topic or doc.title}"[:512],
        difficulty=difficulty,
        scope={
            "topic": topic,
            "chapter_id": str(sp.chapter_id) if sp.chapter_id else None,
            "section_id": str(sp.section_id) if sp.section_id else None,
        },
    )
    db.add(quiz)
    await db.flush()

    passage_by_id = {str(p.chunk_id): p for p in passages}
    for i, it in enumerate(items[:num_questions]):
        raw_type = (it.get("question_type") or "short_answer").lower()
        qtype_str = raw_type.replace("-", "_").replace(" ", "_")
        if qtype_str == "multiplechoice":
            qtype_str = "multiple_choice"
        if qtype_str == "truefalse":
            qtype_str = "true_false"
        try:
            qt = QuizQuestionType(qtype_str)
        except ValueError:
            qt = QuizQuestionType.short_answer
        if qt not in allowed_types:
            qt = allowed_types[i % len(allowed_types)]

        sup_ids = it.get("supporting_chunk_ids") or []
        cites = []
        sps = []
        for sid in sup_ids:
            p = passage_by_id.get(str(sid))
            if not p:
                continue
            cites.append(
                {
                    "chunk_id": str(p.chunk_id),
                    "page_start": p.page_start,
                    "page_end": p.page_end,
                    "chapter_label": p.chapter_label,
                    "section_label": p.section_label,
                }
            )
            sps.append(
                {
                    "chunk_id": str(p.chunk_id),
                    "score": p.score,
                    "text": p.text,
                    "page_start": p.page_start,
                    "page_end": p.page_end,
                    "chapter_label": p.chapter_label,
                    "section_label": p.section_label,
                }
            )
        if not cites and passages:
            p0 = passages[0]
            cites = [
                {
                    "chunk_id": str(p0.chunk_id),
                    "page_start": p0.page_start,
                    "page_end": p0.page_end,
                }
            ]
            sps = [
                {
                    "chunk_id": str(p0.chunk_id),
                    "score": p0.score,
                    "text": p0.text,
                    "page_start": p0.page_start,
                    "page_end": p0.page_end,
                }
            ]

        qq = QuizQuestion(
            quiz_id=quiz.id,
            question_type=qt,
            question_text=it.get("question_text") or "Question",
            options=it.get("options"),
            correct_answer=str(it.get("correct_answer") or ""),
            explanation=it.get("explanation"),
            citations=cites,
            source_passages=sps,
            order_index=i,
        )
        db.add(qq)

    await db.flush()
    return quiz
