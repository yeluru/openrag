"""User flashcards (grounded generation + editable)."""

from uuid import UUID

from sqlalchemy import Enum as SAEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import Difficulty


class Flashcard(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "flashcards"

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
    section_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("document_sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[Difficulty | None] = mapped_column(
        SAEnum(Difficulty, name="flashcard_difficulty", native_enum=False),
        nullable=True,
    )
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    source_passages: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    ai_generated: Mapped[bool] = mapped_column(default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="flashcards")
    document: Mapped["Document | None"] = relationship("Document")
