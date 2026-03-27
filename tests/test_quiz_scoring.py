"""Unit tests for quiz auto-scoring (no database)."""

import uuid

import pytest

from app.db.models.enums import QuizQuestionType
from app.db.models.quiz import QuizQuestion
from app.services.quizzes.scoring import score_attempt


def _q(
    qid: uuid.UUID,
    qtype: QuizQuestionType,
    correct: str,
) -> QuizQuestion:
    return QuizQuestion(
        quiz_id=uuid.uuid4(),
        question_type=qtype,
        question_text="Q",
        options=None,
        correct_answer=correct,
        explanation=None,
        citations=[],
        source_passages=[],
        order_index=0,
        id=qid,
    )


def test_multiple_choice_exact():
    q1 = _q(uuid.uuid4(), QuizQuestionType.multiple_choice, "Paris")
    score, detail = score_attempt([q1], {str(q1.id): "Paris"})
    assert score == 1.0
    assert detail[str(q1.id)] is True


def test_multiple_choice_case_insensitive():
    q1 = _q(uuid.uuid4(), QuizQuestionType.multiple_choice, "Paris")
    score, _ = score_attempt([q1], {str(q1.id): "  paris "})
    assert score == 1.0


def test_true_false_variants():
    q1 = _q(uuid.uuid4(), QuizQuestionType.true_false, "true")
    score, _ = score_attempt([q1], {str(q1.id): "True"})
    assert score == 1.0
    score2, _ = score_attempt([q1], {str(q1.id): "yes"})
    assert score2 == 1.0


def test_short_answer_not_graded():
    q1 = _q(uuid.uuid4(), QuizQuestionType.short_answer, "any")
    score, detail = score_attempt([q1], {str(q1.id): "wrong"})
    assert score == 0.0
    assert detail[str(q1.id)] is None


def test_mixed_graded_fraction():
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    qs = [
        _q(a, QuizQuestionType.multiple_choice, "A"),
        _q(b, QuizQuestionType.multiple_choice, "B"),
        _q(c, QuizQuestionType.short_answer, "essay"),
    ]
    score, detail = score_attempt(qs, {str(a): "A", str(b): "X", str(c): "anything"})
    assert detail[str(c)] is None
    assert score == 0.5
    assert detail[str(a)] is True
    assert detail[str(b)] is False


def test_missing_answer_wrong():
    q1 = _q(uuid.uuid4(), QuizQuestionType.multiple_choice, "Z")
    score, detail = score_attempt([q1], {})
    assert score == 0.0
    assert detail[str(q1.id)] is False
