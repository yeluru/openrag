"""Deterministic pseudo-embeddings for local development without API keys."""

import hashlib
import math
from app.core.config import Settings, get_settings


def _fake_vec(text: str, dim: int) -> list[float]:
    h = hashlib.sha256(text.encode()).digest()
    seed = int.from_bytes(h[:8], "big")
    rng = seed
    out: list[float] = []

    def rnd() -> float:
        nonlocal rng
        rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
        return (rng / 0x7FFFFFFF) * 2 - 1

    for _ in range(dim):
        out.append(rnd())
    norm = math.sqrt(sum(x * x for x in out)) or 1.0
    return [x / norm for x in out]


class MockEmbeddings:
    def __init__(self, settings: Settings | None = None) -> None:
        s = settings or get_settings()
        self.model = f"mock-{s.embedding_model}"
        self.dimensions = s.embedding_dimensions

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [_fake_vec(t, self.dimensions) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return _fake_vec(text, self.dimensions)
