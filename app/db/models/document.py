"""Uploaded document model."""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Document(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "documents"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="Untitled")
    original_filename: Mapped[str] = mapped_column(String(1024), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False, default="application/pdf")
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    author_inferred: Mapped[str | None] = mapped_column(String(512), nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)

    owner: Mapped["User"] = relationship("User", back_populates="documents")
    sections: Mapped[list["DocumentSection"]] = relationship(
        "DocumentSection",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentSection.order_index",
    )
    chunks: Mapped[list["Chunk"]] = relationship(
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )
    ingestion_jobs: Mapped[list["IngestionJob"]] = relationship(
        "IngestionJob", back_populates="document", cascade="all, delete-orphan"
    )
