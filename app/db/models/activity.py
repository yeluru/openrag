"""Lightweight learning activity log."""

from uuid import UUID

from sqlalchemy import Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import LearningActivityType


class LearningActivity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "learning_activities"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_type: Mapped[LearningActivityType] = mapped_column(
        SAEnum(LearningActivityType, name="learning_activity_type", native_enum=False),
        nullable=False,
        index=True,
    )
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    user: Mapped["User"] = relationship("User")
