"""User model."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="owner", cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz", back_populates="user", cascade="all, delete-orphan"
    )
    flashcards: Mapped[list["Flashcard"]] = relationship(
        "Flashcard", back_populates="user", cascade="all, delete-orphan"
    )
    notes: Mapped[list["Note"]] = relationship(
        "Note", back_populates="user", cascade="all, delete-orphan"
    )
