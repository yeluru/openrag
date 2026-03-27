"""Quizzes, questions, and attempts."""

from uuid import UUID

from sqlalchemy import Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import Difficulty, QuizQuestionType


class Quiz(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quizzes"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    difficulty: Mapped[Difficulty] = mapped_column(
        SAEnum(Difficulty, name="quiz_difficulty", native_enum=False),
        nullable=False,
        default=Difficulty.intermediate,
    )
    scope: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped["User"] = relationship("User", back_populates="quizzes")
    document: Mapped["Document | None"] = relationship("Document")
    questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.order_index",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt", back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizQuestion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quiz_questions"

    quiz_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_type: Mapped[QuizQuestionType] = mapped_column(
        SAEnum(QuizQuestionType, name="quiz_question_type", native_enum=False),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list | dict | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    source_passages: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quiz_attempts"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quiz_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship("User")
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="attempts")
