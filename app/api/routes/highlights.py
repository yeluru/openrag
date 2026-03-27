from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.chunk import Chunk
from app.db.models.document import Document
from app.db.models.enums import LearningActivityType
from app.db.models.highlight import HighlightBookmark
from app.db.session import get_db
from app.services.activity.service import log_learning_activity

router = APIRouter(tags=["highlights"])


class HighlightCreate(BaseModel):
    chunk_id: UUID | None = None
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    quote_text: str | None = Field(default=None, max_length=20000)


class HighlightPatch(BaseModel):
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    quote_text: str | None = Field(default=None, max_length=20000)


class HighlightOut(BaseModel):
    id: UUID
    document_id: UUID
    chunk_id: UUID | None
    page_start: int | None
    page_end: int | None
    quote_text: str | None
    created_at: object

    model_config = {"from_attributes": True}


@router.get("/highlights", response_model=list[HighlightOut])
async def list_all_highlights(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
    document_id: UUID | None = None,
    limit: int = Query(default=200, ge=1, le=500),
) -> list[HighlightOut]:
    stmt = select(HighlightBookmark).where(HighlightBookmark.user_id == user_id)
    if document_id is not None:
        stmt = stmt.where(HighlightBookmark.document_id == document_id)
    stmt = stmt.order_by(HighlightBookmark.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return [HighlightOut.model_validate(r) for r in rows]


@router.post("/documents/{document_id}/highlights", response_model=HighlightOut, status_code=status.HTTP_201_CREATED)
async def create_highlight(
    document_id: UUID,
    body: HighlightCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> HighlightOut:
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if body.chunk_id is not None:
        ch = await db.get(Chunk, body.chunk_id)
        if not ch or ch.document_id != document_id:
            raise HTTPException(status_code=400, detail="Chunk not in this document")
    row = HighlightBookmark(
        user_id=user_id,
        document_id=document_id,
        chunk_id=body.chunk_id,
        page_start=body.page_start,
        page_end=body.page_end,
        quote_text=body.quote_text,
    )
    db.add(row)
    await db.flush()
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.highlight,
        meta={"action": "create", "document_id": str(document_id), "highlight_id": str(row.id)},
    )
    return HighlightOut.model_validate(row)


@router.get("/documents/{document_id}/highlights", response_model=list[HighlightOut])
async def list_highlights(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> list[HighlightOut]:
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    res = await db.execute(
        select(HighlightBookmark)
        .where(
            HighlightBookmark.document_id == document_id,
            HighlightBookmark.user_id == user_id,
        )
        .order_by(HighlightBookmark.created_at.desc())
    )
    rows = list(res.scalars().all())
    return [HighlightOut.model_validate(r) for r in rows]


@router.patch("/highlights/{highlight_id}", response_model=HighlightOut)
async def patch_highlight(
    highlight_id: UUID,
    body: HighlightPatch,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> HighlightOut:
    row = await db.get(HighlightBookmark, highlight_id)
    if not row or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    if body.page_start is not None:
        row.page_start = body.page_start
    if body.page_end is not None:
        row.page_end = body.page_end
    if body.quote_text is not None:
        row.quote_text = body.quote_text
    await db.flush()
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.highlight,
        meta={"action": "update", "highlight_id": str(highlight_id)},
    )
    return HighlightOut.model_validate(row)


@router.delete("/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(
    highlight_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> None:
    row = await db.get(HighlightBookmark, highlight_id)
    if not row or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await db.delete(row)
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.highlight,
        meta={"action": "delete", "highlight_id": str(highlight_id)},
    )
