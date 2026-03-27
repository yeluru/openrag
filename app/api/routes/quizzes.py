from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.document import Document
from app.db.models.enums import Difficulty, LearningActivityType, QuizQuestionType
from app.db.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.db.session import get_db
from app.schemas.quiz import (
    QuizAttemptSubmitResponse,
    QuizAttemptSummaryOut,
    QuizDetailResponse,
    QuizGenerateResponse,
    QuizQuestionGenerateOut,
    QuizQuestionGetOut,
)
from app.schemas.scope import ScopePayload
from app.services.activity.service import log_learning_activity
from app.services.generation.quiz_service import generate_quiz
from app.services.quizzes.scoring import score_attempt


class QuizGenerateRequest(BaseModel):
    scope: ScopePayload
    topic: str | None = Field(default=None, max_length=500)
    difficulty: Difficulty = Difficulty.intermediate
    num_questions: int = Field(default=5, ge=1, le=30)
    question_types: list[QuizQuestionType] | None = None


class QuizAttemptRequest(BaseModel):
    """Map question_id (uuid string) -> user's answer text."""

    answers: dict[str, str] = Field(default_factory=dict)


router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz_endpoint(
    body: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> QuizGenerateResponse:
    doc = await db.get(Document, body.scope.document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    quiz = await generate_quiz(
        db,
        user_id,
        body.scope,
        topic=body.topic,
        difficulty=body.difficulty,
        num_questions=body.num_questions,
        question_types=body.question_types,
    )
    qres = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index)
    )
    questions = list(qres.scalars().all())
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.quiz,
        meta={"quiz_id": str(quiz.id), "document_id": str(body.scope.document_id)},
    )
    return QuizGenerateResponse(
        quiz_id=quiz.id,
        title=quiz.title,
        difficulty=quiz.difficulty.value,
        questions=[
            QuizQuestionGenerateOut(
                id=q.id,
                question_type=q.question_type.value,
                question_text=q.question_text,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                citations=q.citations or [],
                source_passages=q.source_passages or [],
                order_index=q.order_index,
            )
            for q in questions
        ],
    )


@router.post("/{quiz_id}/attempts", response_model=QuizAttemptSubmitResponse)
async def submit_quiz_attempt(
    quiz_id: UUID,
    body: QuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> QuizAttemptSubmitResponse:
    quiz = await db.get(Quiz, quiz_id)
    if not quiz or quiz.user_id != user_id:
        raise HTTPException(status_code=404, detail="Quiz not found")
    qres = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index)
    )
    questions = list(qres.scalars().all())
    score_ratio, per_q = score_attempt(questions, body.answers)
    score_pct = round(score_ratio * 100.0, 2)
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        answers=body.answers,
        score=score_pct,
    )
    db.add(attempt)
    await db.flush()
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.quiz_attempt,
        meta={
            "quiz_id": str(quiz_id),
            "attempt_id": str(attempt.id),
            "score": score_pct,
        },
    )
    return QuizAttemptSubmitResponse(
        attempt_id=attempt.id,
        score=score_pct,
        score_fraction=score_ratio,
        per_question=dict(per_q),
    )


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptSummaryOut])
async def list_quiz_attempts(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> list[QuizAttemptSummaryOut]:
    quiz = await db.get(Quiz, quiz_id)
    if not quiz or quiz.user_id != user_id:
        raise HTTPException(status_code=404, detail="Quiz not found")
    res = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.created_at.desc())
    )
    rows = list(res.scalars().all())
    return [
        QuizAttemptSummaryOut(
            attempt_id=a.id,
            score=a.score,
            answers=dict(a.answers or {}),
            created_at=a.created_at,
        )
        for a in rows
    ]


@router.get(
    "/{quiz_id}",
    response_model=QuizDetailResponse,
    response_model_exclude_unset=True,
)
async def get_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
    include_answers: bool = True,
) -> QuizDetailResponse:
    quiz = await db.get(Quiz, quiz_id)
    if not quiz or quiz.user_id != user_id:
        raise HTTPException(status_code=404, detail="Quiz not found")
    qres = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index)
    )
    questions = list(qres.scalars().all())
    out_q: list[QuizQuestionGetOut] = []
    for q in questions:
        base = QuizQuestionGetOut(
            id=q.id,
            question_type=q.question_type.value,
            question_text=q.question_text,
            options=q.options,
            order_index=q.order_index,
            citations=q.citations or [],
        )
        if include_answers:
            out_q.append(
                base.model_copy(
                    update={
                        "correct_answer": q.correct_answer,
                        "explanation": q.explanation,
                        "source_passages": q.source_passages or [],
                    }
                )
            )
        else:
            out_q.append(base)
    return QuizDetailResponse(
        quiz_id=quiz.id,
        title=quiz.title,
        difficulty=quiz.difficulty.value,
        scope=quiz.scope or {},
        questions=out_q,
    )
