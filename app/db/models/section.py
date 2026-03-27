"""Hierarchical document sections (chapters / sections / logical)."""

from uuid import UUID, uuid4

from sqlalchemy import Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.enums import SectionKind


class DocumentSection(Base, TimestampMixin):
    __tablename__ = "document_sections"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("document_sections.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    kind: Mapped[SectionKind] = mapped_column(
        SAEnum(SectionKind, name="section_kind", native_enum=False),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    depth: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)

    document: Mapped["Document"] = relationship("Document", back_populates="sections")
    parent: Mapped["DocumentSection | None"] = relationship(
        "DocumentSection",
        remote_side=[id],
        back_populates="children",
    )
    children: Mapped[list["DocumentSection"]] = relationship(
        "DocumentSection",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="DocumentSection.order_index",
    )
    chunks: Mapped[list["Chunk"]] = relationship("Chunk", back_populates="section")
