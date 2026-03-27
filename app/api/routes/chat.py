from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.document import Document
from app.db.models.enums import LearningActivityType
from app.db.session import get_db
from app.schemas.chat import ChatAskResponse
from app.schemas.grounded import GroundedAnswerResponse
from app.schemas.scope import ScopePayload
from app.services.activity.service import log_learning_activity
from app.services.chat.persist import (
    append_turn,
    get_or_create_session,
    list_messages,
    list_sessions_for_user,
)
from app.services.generation.answer_service import generate_grounded_answer


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=8000)
    scope: ScopePayload
    mode: str = Field(
        default="beginner_explanation",
        pattern="^(beginner_explanation|concise_summary|deep_explanation|interview_prep|concept_comparison)$",
    )
    session_id: UUID | None = None
    top_k: int | None = Field(default=None, ge=1, le=50)


class CreateChatSessionBody(BaseModel):
    document_id: UUID | None = None


class ChatSessionOut(BaseModel):
    id: UUID
    document_id: UUID | None
    title: str | None
    created_at: object
    updated_at: object

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    structured_response: dict | None
    created_at: object

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", status_code=201)
async def create_chat_session(
    body: CreateChatSessionBody,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> ChatSessionOut:
    from app.db.models.chat import ChatSession

    if body.document_id is not None:
        doc = await db.get(Document, body.document_id)
        if not doc or doc.user_id != user_id:
            raise HTTPException(status_code=404, detail="Document not found")
    session = ChatSession(user_id=user_id, document_id=body.document_id, title=None)
    db.add(session)
    await db.flush()
    return ChatSessionOut.model_validate(session)


@router.get("/sessions", response_model=list[ChatSessionOut])
async def get_chat_sessions(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
    document_id: UUID | None = None,
) -> list[ChatSessionOut]:
    rows = await list_sessions_for_user(db, user_id, document_id=document_id)
    return [ChatSessionOut.model_validate(s) for s in rows]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_session_messages(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> list[ChatMessageOut]:
    rows = await list_messages(db, session_id, user_id)
    return [
        ChatMessageOut(
            id=m.id,
            role=m.role.value,
            content=m.content,
            structured_response=m.structured_response,
            created_at=m.created_at,
        )
        for m in rows
    ]


@router.post("/ask", response_model=ChatAskResponse)
async def ask_question(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> ChatAskResponse:
    doc = await db.get(Document, body.scope.document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")

    response: GroundedAnswerResponse = await generate_grounded_answer(
        db,
        body.question,
        body.scope,
        mode=body.mode,
        top_k=body.top_k,
    )

    session = await get_or_create_session(
        db,
        user_id=user_id,
        scope=body.scope,
        session_id=body.session_id,
        title_hint=body.question,
    )
    await append_turn(db, session_id=session.id, question=body.question, response=response)

    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.chat,
        meta={
            "session_id": str(session.id),
            "document_id": str(body.scope.document_id),
            "mode": body.mode,
        },
    )

    return ChatAskResponse(session_id=session.id, **response.model_dump())
