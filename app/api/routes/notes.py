from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.document import Document
from app.db.models.enums import LearningActivityType
from app.db.session import get_db
from app.services.activity.service import log_learning_activity
from app.schemas.scope import ScopePayload
from app.schemas.note_api import NoteAssistResponse
from app.services.generation.notes_service import generate_note_assist


class NoteAssistRequest(BaseModel):
    scope: ScopePayload
    instruction: str = Field(min_length=1, max_length=8000)
    title: str | None = Field(default=None, max_length=512)
    top_k: int = Field(default=10, ge=1, le=40)


router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("/assist", response_model=NoteAssistResponse)
async def notes_assist(
    body: NoteAssistRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> NoteAssistResponse:
    doc = await db.get(Document, body.scope.document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    note = await generate_note_assist(
        db,
        user_id,
        body.scope,
        instruction=body.instruction,
        title=body.title,
        top_k=body.top_k,
    )
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.note,
        meta={"note_id": str(note.id), "document_id": str(body.scope.document_id)},
    )
    return NoteAssistResponse(
        note_id=note.id,
        title=note.title,
        content=note.content,
        citations=note.citations or [],
        ai_generated=note.ai_generated,
    )
