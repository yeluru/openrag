"""OpenAI-compatible embedding API (works with Azure OpenAI via base URL)."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class OpenAICompatibleEmbeddings:
    def __init__(self, settings: Settings | None = None) -> None:
        self._s = settings or get_settings()
        self.model = self._s.embedding_model
        self.dimensions = self._s.embedding_dimensions
        self._url = f"{self._s.embedding_api_base.rstrip('/')}/embeddings"
        self._headers = {
            "Authorization": f"Bearer {self._s.embedding_api_key}",
            "Content-Type": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        reraise=True,
    )
    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(self._url, json=payload, headers=self._headers)
            r.raise_for_status()
            return r.json()

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        out: list[list[float]] = []
        batch = self._s.embedding_batch_size
        for i in range(0, len(texts), batch):
            chunk = texts[i : i + batch]
            body: dict[str, Any] = {"model": self.model, "input": chunk}
            if self.dimensions and "text-embedding-3" in self.model:
                body["dimensions"] = self.dimensions
            data = await self._post(body)
            items = sorted(data.get("data", []), key=lambda x: x.get("index", 0))
            for it in items:
                out.append(it["embedding"])
            logger.debug("Embedded batch %s vectors", len(chunk))
        return out

    async def embed_query(self, text: str) -> list[float]:
        vecs = await self.embed_texts([text])
        return vecs[0] if vecs else []
