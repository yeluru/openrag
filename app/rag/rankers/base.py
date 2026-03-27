"""Extension point for cross-encoder / LLM reranking.

Implement ``Reranker.rank(query, passages) -> list[RetrievedPassage]`` and inject
from ``retrieve_passages`` when you add a concrete reranker.
"""

from typing import Protocol, runtime_checkable

from app.rag.retrievers.schemas import RetrievedPassage


@runtime_checkable
class Reranker(Protocol):
    async def rank(self, query: str, passages: list[RetrievedPassage]) -> list[RetrievedPassage]:
        ...
