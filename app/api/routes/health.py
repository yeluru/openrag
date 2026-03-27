from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import optional_api_key
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(optional_api_key),
) -> HealthResponse:
    settings = get_settings()
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        app=settings.app_name,
        database=db_ok,
        debug=settings.debug,
    )
