"""Chat API response models."""

from uuid import UUID

from app.schemas.grounded import GroundedAnswerResponse


class ChatAskResponse(GroundedAnswerResponse):
    """Grounded answer plus persisted session id."""

    session_id: UUID
