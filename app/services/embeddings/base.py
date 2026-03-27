"""Embedding provider protocol."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class EmbeddingProvider(Protocol):
    model: str
    dimensions: int

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Return one vector per input string (same order)."""
        ...

    async def embed_query(self, text: str) -> list[float]:
        ...
