"""Optional API key verification and dev user resolution."""

from uuid import UUID

from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def verify_service_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    expected = settings.service_api_key
    if not expected:
        return
    if not x_api_key or x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


def parse_user_id_header(x_user_id: str | None) -> UUID | None:
    if not x_user_id:
        return None
    try:
        return UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id must be a valid UUID",
        ) from None
