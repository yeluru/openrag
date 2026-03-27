"""Ingestion job tracking."""

from uuid import UUID

from sqlalchemy import Enum as SAEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import IngestionStatus


class IngestionJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ingestion_jobs"

    document_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[IngestionStatus] = mapped_column(
        SAEnum(IngestionStatus, name="ingestion_status", native_enum=False),
        nullable=False,
        default=IngestionStatus.uploaded,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    progress_meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    document: Mapped["Document"] = relationship("Document", back_populates="ingestion_jobs")
