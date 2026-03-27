"""
Shared pytest configuration for OpenRAG.

Environment (optional):
  OPENRAG_TEST_BASE_URL — If set (e.g. http://127.0.0.1:8000), hit a live server instead of ASGI in-process.
  OPENRAG_TEST_USER_ID — UUID for X-User-Id (default: deterministic test UUID).
  OPENRAG_TEST_API_KEY — X-Api-Key when service_api_key is configured on the server.

Integration tests are skipped unless OpenAI-compatible embedding + LLM keys are configured
(EMBEDDING_PROVIDER=openai, EMBEDDING_API_KEY, LLM_PROVIDER=openai, LLM_API_KEY).

Database: point POSTGRES_* / DATABASE_URL fields in .env at a dev or dedicated test DB (same schema as production;
run alembic upgrade head). There is no separate test URL in code—use env vars or a second .env for CI.
"""

from __future__ import annotations

import os
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
import pytest_asyncio

from app.core.config import get_settings
from app.main import app


def api_prefix() -> str:
    return get_settings().api_prefix.rstrip("/") or ""


@pytest.fixture(scope="session")
def api_v1_prefix() -> str:
    return api_prefix()


def integration_skip_reason() -> str | None:
    s = get_settings()
    if s.embedding_provider != "openai":
        return "Set EMBEDDING_PROVIDER=openai for integration tests (no mocked RAG)."
    if not (s.embedding_api_key or "").strip():
        return "Set EMBEDDING_API_KEY for integration tests."
    if s.llm_provider != "openai":
        return "Set LLM_PROVIDER=openai for integration tests."
    if not (s.llm_api_key or "").strip():
        return "Set LLM_API_KEY for integration tests."
    return None


@pytest.fixture(scope="session")
def require_integration_stack() -> None:
    reason = integration_skip_reason()
    if reason:
        pytest.skip(reason)


@pytest.fixture(scope="module")
def test_user_id() -> uuid.UUID:
    raw = os.environ.get("OPENRAG_TEST_USER_ID", "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee")
    return uuid.UUID(raw)


@pytest.fixture(scope="module")
def auth_headers(test_user_id: uuid.UUID) -> dict[str, str]:
    h: dict[str, str] = {"X-User-Id": str(test_user_id)}
    key = os.environ.get("OPENRAG_TEST_API_KEY", "").strip()
    if key:
        h["X-Api-Key"] = key
    elif get_settings().service_api_key:
        pytest.fail(
            "Server expects SERVICE_API_KEY; set OPENRAG_TEST_API_KEY or clear service_api_key in .env for tests."
        )
    return h


def build_two_page_study_pdf() -> bytes:
    """Minimal multi-page PDF with distinct, searchable text per page (PyMuPDF)."""
    import fitz  # pymupdf

    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text(
        (72, 72),
        "PAGE_ONE_QUOKKA_MARKER. This page describes photosynthesis efficiency in deep shade ferns. "
        "The quokka control group had no relation to this process.",
        fontsize=11,
    )
    p2 = doc.new_page()
    p2.insert_text(
        (72, 72),
        "PAGE_TWO_BETA_MARKER. The beta protocol mandates three-point harness checks before "
        "underwater basket weaving. Never skip the harness inspection step.",
        fontsize=11,
    )
    return doc.tobytes()


@pytest_asyncio.fixture
async def http_client() -> AsyncIterator[httpx.AsyncClient]:
    """Short-lived ASGI client (default asyncio loop)."""
    base = os.environ.get("OPENRAG_TEST_BASE_URL", "").strip()
    if base:
        async with httpx.AsyncClient(base_url=base.rstrip("/"), timeout=httpx.Timeout(180.0)) as client:
            yield client
    else:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
            timeout=httpx.Timeout(180.0),
        ) as client:
            yield client


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def integration_engine_reset() -> AsyncIterator[None]:
    """Drop pooled asyncpg connections so the integration module uses one event loop only."""
    from app.db.session import engine

    await engine.dispose()
    yield
    await engine.dispose()


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def integration_http_client(
    integration_engine_reset: None,
) -> AsyncIterator[httpx.AsyncClient]:
    """Module-scoped client; must run on the same loop as integration_engine_reset."""
    base = os.environ.get("OPENRAG_TEST_BASE_URL", "").strip()
    if base:
        async with httpx.AsyncClient(base_url=base.rstrip("/"), timeout=httpx.Timeout(180.0)) as client:
            yield client
    else:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://test",
            timeout=httpx.Timeout(180.0),
        ) as client:
            yield client


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def ingested_document_id(
    require_integration_stack: None,
    integration_http_client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> AsyncIterator[uuid.UUID]:
    """Upload PDF, poll ingestion until ready; yields document_id."""
    import asyncio

    pdf = build_two_page_study_pdf()
    p = api_prefix()
    up = await integration_http_client.post(
        f"{p}/documents",
        headers=auth_headers,
        files={"file": ("openrag_integration.pdf", pdf, "application/pdf")},
    )
    assert up.status_code == 201, up.text
    body: dict[str, Any] = up.json()
    doc_id = uuid.UUID(body["document_id"])

    deadline = time.monotonic() + 240.0
    status = ""
    while time.monotonic() < deadline:
        st = await integration_http_client.get(f"{p}/documents/{doc_id}/ingestion", headers=auth_headers)
        assert st.status_code == 200, st.text
        payload = st.json()
        status = payload["status"]
        if status == "ready":
            break
        if status == "failed":
            pytest.fail(f"Ingestion failed: {payload!r}")
        await asyncio.sleep(0.75)
    else:
        pytest.fail(f"Ingestion timed out (last status={status!r})")

    info = await integration_http_client.get(f"{p}/documents/{doc_id}", headers=auth_headers)
    assert info.status_code == 200, info.text
    yield doc_id
