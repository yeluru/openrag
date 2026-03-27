"""Resolve embedding provider from settings."""

from typing import Any

from app.core.config import Settings, get_settings


def get_embedding_provider(settings: Settings | None = None) -> Any:
    s = settings or get_settings()
    if s.embedding_provider == "mock":
        from app.services.embeddings.mock_provider import MockEmbeddings

        return MockEmbeddings(s)
    from app.services.embeddings.openai_provider import OpenAICompatibleEmbeddings

    return OpenAICompatibleEmbeddings(s)
