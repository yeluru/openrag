"""Shared FastAPI dependencies."""

from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import parse_user_id_header, verify_service_api_key
from app.db.session import get_db
from app.db.models.user import User
from app.services.documents.document_service import ensure_user


async def optional_api_key(_: None = Depends(verify_service_api_key)) -> None:
    return None


async def _require_user_uuid(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> UUID:
    uid = parse_user_id_header(x_user_id)
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header X-User-Id (UUID) is required",
        )
    return uid


async def current_user_id(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_require_user_uuid),
) -> UUID:
    """Resolve header UUID and ensure a `users` row exists (FK-safe for inserts)."""
    await ensure_user(db, user_id)
    return user_id


async def current_user(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
) -> User:
    u = await db.get(User, user_id)
    if u is None:
        return await ensure_user(db, user_id)
    return u
