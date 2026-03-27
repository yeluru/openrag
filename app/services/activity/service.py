"""Append-only learning activity log."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.activity import LearningActivity
from app.db.models.enums import LearningActivityType


async def log_learning_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    activity_type: LearningActivityType,
    meta: dict | None = None,
) -> LearningActivity:
    row = LearningActivity(
        user_id=user_id,
        activity_type=activity_type,
        meta=meta or {},
    )
    db.add(row)
    await db.flush()
    return row
