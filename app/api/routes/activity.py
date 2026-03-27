from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.activity import LearningActivity
from app.db.models.enums import LearningActivityType
from app.db.session import get_db

router = APIRouter(prefix="/activity", tags=["activity"])


class ActivityOut(BaseModel):
    id: UUID
    activity_type: str
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: object

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ActivityOut])
async def list_activity(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
    limit: int = Query(default=50, ge=1, le=200),
    activity_type: LearningActivityType | None = None,
) -> list[ActivityOut]:
    stmt = select(LearningActivity).where(LearningActivity.user_id == user_id)
    if activity_type is not None:
        stmt = stmt.where(LearningActivity.activity_type == activity_type)
    stmt = stmt.order_by(LearningActivity.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return [
        ActivityOut(
            id=r.id,
            activity_type=r.activity_type.value,
            meta=r.meta,
            created_at=r.created_at,
        )
        for r in rows
    ]


class DocumentEngagementOut(BaseModel):
    document_id: UUID
    event_count: int
    last_activity_at: datetime | None = None


def _doc_id_from_meta(meta: dict[str, Any]) -> UUID | None:
    raw = meta.get("document_id")
    if raw is None:
        return None
    try:
        return UUID(str(raw))
    except (ValueError, TypeError):
        return None


@router.get("/document-engagement", response_model=list[DocumentEngagementOut])
async def document_engagement_summary(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
    limit: int = Query(default=500, ge=50, le=2000),
) -> list[DocumentEngagementOut]:
    """Aggregate recent learning events that reference a document_id in meta."""
    stmt = (
        select(LearningActivity)
        .where(LearningActivity.user_id == user_id)
        .order_by(LearningActivity.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    rows = list(res.scalars().all())

    counts: dict[UUID, int] = {}
    last_at: dict[UUID, datetime] = {}
    for r in rows:
        did = _doc_id_from_meta(r.meta or {})
        if did is None:
            continue
        counts[did] = counts.get(did, 0) + 1
        if did not in last_at:
            last_at[did] = r.created_at

    return [
        DocumentEngagementOut(
            document_id=did,
            event_count=c,
            last_activity_at=last_at.get(did),
        )
        for did, c in sorted(counts.items(), key=lambda x: (-x[1], str(x[0])))
    ]
