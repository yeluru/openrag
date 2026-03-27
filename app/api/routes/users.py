from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.session import get_db
from app.services.documents.document_service import ensure_user

router = APIRouter(prefix="/users", tags=["users"])


class UserOut(BaseModel):
    id: UUID
    email: str | None
    display_name: str | None

    model_config = {"from_attributes": True}


@router.post("/bootstrap", response_model=UserOut)
async def bootstrap_user(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> UserOut:
    u = await ensure_user(db, user_id)
    return UserOut.model_validate(u)
