"""Score quiz attempts for auto-gradable question types."""

from __future__ import annotations

import re

from app.db.models.enums import QuizQuestionType
from app.db.models.quiz import QuizQuestion


def _norm(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _bool_match(user: str, correct: str) -> bool:
    u = _norm(user)
    c = _norm(correct)
    if u in ("t", "true", "yes", "1"):
        u = "true"
    if u in ("f", "false", "no", "0"):
        u = "false"
    if c in ("t", "true", "yes", "1"):
        c = "true"
    if c in ("f", "false", "no", "0"):
        c = "false"
    return u == c


def score_attempt(
    questions: list[QuizQuestion],
    answers: dict[str, str],
) -> tuple[float, dict[str, bool | None]]:
    """
    Return (score 0..1, per-question correct: True/False/None ungraded).
    Short answer / concept_explanation are not auto-graded (None).
    """
    if not questions:
        return 0.0, {}

    graded = 0
    correct_n = 0
    detail: dict[str, bool | None] = {}

    for q in questions:
        qid = str(q.id)
        raw = answers.get(qid)
        if raw is None:
            detail[qid] = False
            graded += 1
            continue

        if q.question_type in (QuizQuestionType.short_answer, QuizQuestionType.concept_explanation):
            detail[qid] = None
            continue

        graded += 1
        ok = False
        if q.question_type == QuizQuestionType.true_false:
            ok = _bool_match(raw, q.correct_answer)
        else:
            ok = _norm(raw) == _norm(q.correct_answer)

        detail[qid] = ok
        if ok:
            correct_n += 1

    if graded == 0:
        return 0.0, detail
    return correct_n / graded, detail
