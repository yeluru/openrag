"""Text chunks with optional vector embedding (pgvector)."""

from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# Default embedding width; must match Alembic migration and settings.embedding_dimensions
EMBEDDING_DIM = 1536


class Chunk(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "chunks"

    document_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("document_sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chapter_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    section_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    char_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
    section: Mapped["DocumentSection | None"] = relationship(
        "DocumentSection", back_populates="chunks"
    )
