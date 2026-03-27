"""OpenAI-compatible chat completions."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class OpenAICompatibleLLM:
    def __init__(self, settings: Settings | None = None) -> None:
        self._s = settings or get_settings()
        self.model = self._s.llm_model
        self._url = f"{self._s.llm_api_base.rstrip('/')}/chat/completions"
        self._headers = {
            "Authorization": f"Bearer {self._s.llm_api_key}",
            "Content-Type": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        reraise=True,
    )
    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_format_json: bool = False,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self._s.llm_temperature,
            "max_tokens": max_tokens if max_tokens is not None else self._s.llm_max_tokens,
        }
        if response_format_json:
            payload["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(self._url, json=payload, headers=self._headers)
            r.raise_for_status()
            data = r.json()
        content = data["choices"][0]["message"]["content"]
        logger.debug("LLM completion length=%s", len(content or ""))
        return content or ""


class MockLLM:
    def __init__(self, settings: Settings | None = None) -> None:
        s = settings or get_settings()
        self.model = f"mock-{s.llm_model}"

    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_format_json: bool = False,
    ) -> str:
        last = messages[-1]["content"] if messages else ""
        if response_format_json:
            return json.dumps(
                {
                    "answer": f"[mock] Based on provided sources: {last[:200]}",
                    "insufficient_evidence": False,
                }
            )
        return f"[mock] Summarized from retrieved passages (preview): {last[:400]}"


def get_llm(settings: Settings | None = None) -> Any:
    s = settings or get_settings()
    if s.llm_provider == "mock":
        return MockLLM(s)
    return OpenAICompatibleLLM(s)
