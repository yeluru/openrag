"""Persist chat turns after grounded generation."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.enums import ChatRole
from app.schemas.grounded import GroundedAnswerResponse
from app.schemas.scope import ScopePayload


async def get_or_create_session(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    scope: ScopePayload,
    session_id: uuid.UUID | None,
    title_hint: str,
) -> ChatSession:
    if session_id:
        session = await db.get(ChatSession, session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
        if session.document_id and session.document_id != scope.document_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session document does not match request scope",
            )
        if session.document_id is None:
            session.document_id = scope.document_id
        return session

    title = (title_hint[:200] + "…") if len(title_hint) > 200 else title_hint
    session = ChatSession(
        user_id=user_id,
        document_id=scope.document_id,
        title=title,
    )
    db.add(session)
    await db.flush()
    return session


async def append_turn(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    question: str,
    response: GroundedAnswerResponse,
) -> None:
    user_row = ChatMessage(
        session_id=session_id,
        role=ChatRole.user,
        content=question,
        structured_response=None,
    )
    asst_row = ChatMessage(
        session_id=session_id,
        role=ChatRole.assistant,
        content=response.answer,
        structured_response=response.model_dump(mode="json"),  # JSONB-safe
    )
    db.add_all([user_row, asst_row])
    await db.flush()


async def list_sessions_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    document_id: uuid.UUID | None = None,
) -> list[ChatSession]:
    stmt = select(ChatSession).where(ChatSession.user_id == user_id)
    if document_id is not None:
        stmt = stmt.where(ChatSession.document_id == document_id)
    stmt = stmt.order_by(ChatSession.updated_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def list_messages(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list[ChatMessage]:
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())
