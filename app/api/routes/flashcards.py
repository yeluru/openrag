from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.document import Document
from app.db.models.enums import LearningActivityType
from app.db.models.flashcard import Flashcard
from app.db.session import get_db
from app.services.activity.service import log_learning_activity
from app.schemas.scope import ScopePayload
from app.schemas.flashcard_api import FlashcardGenerateResponse, FlashcardItemOut, FlashcardPatchResponse
from app.services.generation.flashcard_service import generate_flashcards


class FlashcardGenerateRequest(BaseModel):
    scope: ScopePayload
    topic: str | None = Field(default=None, max_length=500)
    count: int = Field(default=10, ge=1, le=50)


class FlashcardPatch(BaseModel):
    front: str | None = Field(default=None, max_length=8000)
    back: str | None = Field(default=None, max_length=8000)


router = APIRouter(prefix="/flashcards", tags=["flashcards"])


@router.post("/generate", response_model=FlashcardGenerateResponse)
async def generate_flashcards_endpoint(
    body: FlashcardGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> FlashcardGenerateResponse:
    doc = await db.get(Document, body.scope.document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    cards = await generate_flashcards(
        db,
        user_id,
        body.scope,
        topic=body.topic,
        count=body.count,
    )
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.flashcard,
        meta={
            "document_id": str(body.scope.document_id),
            "count": len(cards),
        },
    )
    return FlashcardGenerateResponse(
        flashcards=[
            FlashcardItemOut(
                id=c.id,
                front=c.front,
                back=c.back,
                difficulty=c.difficulty.value if c.difficulty else None,
                citations=c.citations or [],
                source_passages=c.source_passages or [],
                ai_generated=c.ai_generated,
            )
            for c in cards
        ]
    )


@router.patch("/{flashcard_id}", response_model=FlashcardPatchResponse)
async def patch_flashcard(
    flashcard_id: UUID,
    body: FlashcardPatch,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> FlashcardPatchResponse:
    fc = await db.get(Flashcard, flashcard_id)
    if not fc or fc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    if body.front is not None:
        fc.front = body.front
    if body.back is not None:
        fc.back = body.back
    await db.flush()
    return FlashcardPatchResponse(id=fc.id, front=fc.front, back=fc.back)
