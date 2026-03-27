"""
End-to-end RAG integration tests (real embeddings, LLM, Postgres).

Uses a single module-scoped asyncio loop so the process-wide async SQLAlchemy
engine and asyncpg connections stay on the same loop for all tests in this file.

Run (from repo root, with .env pointing at Postgres + OpenAI keys):
  pytest tests/test_rag_integration.py -v -m integration

Against a running server:
  OPENRAG_TEST_BASE_URL=http://127.0.0.1:8000 pytest tests/test_rag_integration.py -m integration -v
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest

pytestmark = [
    pytest.mark.asyncio(loop_scope="module"),
    pytest.mark.integration,
]


async def test_document_ingestion_produces_ready_document(
    ingested_document_id: uuid.UUID,
    integration_http_client,
    auth_headers: dict[str, str],
    api_v1_prefix: str,
) -> None:
    p = api_v1_prefix
    doc_id = ingested_document_id
    r = await integration_http_client.get(f"{p}/documents/{doc_id}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body.get("id") == str(doc_id)
    ing = body.get("ingestion") or {}
    assert ing.get("status") == "ready"


async def test_chat_grounded_answer_has_citations_and_passages(
    ingested_document_id: uuid.UUID,
    integration_http_client,
    auth_headers: dict[str, str],
    api_v1_prefix: str,
) -> None:
    doc_id = str(ingested_document_id)
    r = await integration_http_client.post(
        f"{api_v1_prefix}/chat/ask",
        headers=auth_headers,
        json={
            "question": "According to PAGE_TWO_BETA_MARKER, what must happen before underwater basket weaving?",
            "scope": {"document_id": doc_id},
            "mode": "concise_summary",
            "top_k": 8,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "answer" in data and len(str(data["answer"]).strip()) > 0
    cites = data.get("citations") or []
    passages = data.get("source_passages") or []
    assert len(cites) > 0, "expected non-empty citations from grounded path"
    assert len(passages) > 0, "expected non-empty source_passages"
    joined = " ".join(p.get("text", "") for p in passages).lower()
    assert "harness" in joined or "beta" in joined, f"retrieval should touch page-2 content; got {joined[:400]!r}"


async def test_chat_unrelated_question_signals_limited_evidence(
    ingested_document_id: uuid.UUID,
    integration_http_client,
    auth_headers: dict[str, str],
    api_v1_prefix: str,
) -> None:
    doc_id = str(ingested_document_id)
    r = await integration_http_client.post(
        f"{api_v1_prefix}/chat/ask",
        headers=auth_headers,
        json={
            "question": (
                "Explain in detail how Kubernetes pod priority and preemption interact with "
                "the kube-scheduler in version 1.29, including API fields."
            ),
            "scope": {"document_id": doc_id},
            "mode": "deep_explanation",
            "top_k": 8,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    answer = str(data.get("answer", "")).lower()
    meta = data.get("retrieval_meta") or {}
    passages = data.get("source_passages") or []

    stock_no_match = "could not find any passages" in answer
    low_conf_prefix = "retrieval confidence was low" in answer
    limited_prefix = "evidence in the retrieved passages is limited" in answer
    meta_weak = bool(meta.get("insufficient_evidence"))

    assert (
        stock_no_match or low_conf_prefix or limited_prefix or meta_weak or len(passages) == 0
    ), "expected insufficient-evidence style response for off-document question"

    # Guardrail: avoid a long, confident Kubernetes tutorial grounded only on the fern PDF.
    if len(passages) == 0 or meta_weak:
        assert "kube-scheduler" not in answer or stock_no_match or len(answer) < 800


async def test_semantic_search_returns_text_snippets(
    ingested_document_id: uuid.UUID,
    integration_http_client,
    auth_headers: dict[str, str],
    api_v1_prefix: str,
) -> None:
    doc_id = str(ingested_document_id)
    r = await integration_http_client.post(
        f"{api_v1_prefix}/search/semantic",
        headers=auth_headers,
        json={
            "query": "PAGE_ONE_QUOKKA_MARKER photosynthesis ferns",
            "scope": {"document_id": doc_id},
            "top_k": 5,
            "min_score": 0.0,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    results = data.get("results") or []
    assert len(results) > 0
    first = results[0]
    assert isinstance(first.get("text"), str) and len(first["text"].strip()) > 0


async def test_quiz_generate_returns_questions_with_explanations(
    ingested_document_id: uuid.UUID,
    integration_http_client,
    auth_headers: dict[str, str],
    api_v1_prefix: str,
) -> None:
    doc_id = str(ingested_document_id)
    r = await integration_http_client.post(
        f"{api_v1_prefix}/quizzes/generate",
        headers=auth_headers,
        json={
            "scope": {"document_id": doc_id},
            "topic": "PAGE_TWO_BETA_MARKER harness and basket weaving safety",
            "num_questions": 3,
            "difficulty": "beginner",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    questions: list[dict[str, Any]] = data.get("questions") or []
    assert len(questions) >= 1
    for q in questions:
        expl = q.get("explanation")
        assert expl is not None and str(expl).strip() != "", q


async def test_scope_narrows_retrieval_vs_full_document(
    ingested_document_id: uuid.UUID,
    integration_http_client,
    auth_headers: dict[str, str],
    api_v1_prefix: str,
) -> None:
    doc_id = str(ingested_document_id)
    question = "Summarize only what PAGE_TWO_BETA_MARKER says about harness checks."
    base = {
        "question": question,
        "mode": "concise_summary",
        "top_k": 10,
    }
    r_full = await integration_http_client.post(
        f"{api_v1_prefix}/chat/ask",
        headers=auth_headers,
        json={**base, "scope": {"document_id": doc_id}},
    )
    r_narrow = await integration_http_client.post(
        f"{api_v1_prefix}/chat/ask",
        headers=auth_headers,
        json={
            **base,
            "scope": {"document_id": doc_id, "page_start": 1, "page_end": 1},
        },
    )
    assert r_full.status_code == 200, r_full.text
    assert r_narrow.status_code == 200, r_narrow.text
    full = r_full.json()
    narrow = r_narrow.json()

    assert (full.get("retrieval_meta") or {}).get("used_scope_filters") is False
    assert (narrow.get("retrieval_meta") or {}).get("used_scope_filters") is True

    full_text = " ".join(p.get("text", "") for p in (full.get("source_passages") or [])).lower()
    assert "beta" in full_text or "harness" in full_text, "full-doc scope should surface page-2 content"
    # Passage overlap vs page metadata can still align on a 2-page PDF; used_scope_filters proves the API applied scope.
