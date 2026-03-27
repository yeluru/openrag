#!/usr/bin/env python3
"""
HTTP smoke checks for chat persistence, quiz attempts, highlights, and activity.

Requires a running API (e.g. uvicorn app.main:app) and Postgres with migrations applied.

Environment:
  OPENRAG_BASE_URL   default http://127.0.0.1:8000
  OPENRAG_API_PREFIX default /api/v1 (must match app api_prefix)
  OPENRAG_USER_ID    UUID for X-User-Id (required)
  OPENRAG_API_KEY    optional, sent as X-Api-Key if service_api_key is set on server
  OPENRAG_DOCUMENT_ID  UUID of an owned, ingested document (required for highlights + quiz flow)

If OPENRAG_DOCUMENT_ID is set, optionally:
  OPENRAG_QUIZ_ID    existing quiz UUID — submit attempt + list attempts
  Otherwise skips quiz HTTP checks (unit tests cover scoring).

Chat /ask is optional (needs retrieval + LLM):
  OPENRAG_RUN_CHAT_ASK=1  — POST /chat/ask once and verify messages grow
"""

from __future__ import annotations

import os
import sys
import uuid
from typing import Any

import httpx


def _fail(msg: str) -> None:
    print("FAIL:", msg, file=sys.stderr)
    raise SystemExit(1)


def _headers() -> dict[str, str]:
    uid = os.environ.get("OPENRAG_USER_ID")
    if not uid:
        _fail("Set OPENRAG_USER_ID (UUID)")
    try:
        uuid.UUID(uid)
    except ValueError:
        _fail("OPENRAG_USER_ID must be a valid UUID")
    h = {"X-User-Id": uid}
    key = os.environ.get("OPENRAG_API_KEY", "")
    if key:
        h["X-Api-Key"] = key
    return h


def main() -> None:
    base = os.environ.get("OPENRAG_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    prefix = os.environ.get("OPENRAG_API_PREFIX", "/api/v1").rstrip("/") or ""
    root = f"{base}{prefix}"
    doc_raw = os.environ.get("OPENRAG_DOCUMENT_ID")
    document_id: uuid.UUID | None
    if doc_raw:
        try:
            document_id = uuid.UUID(doc_raw)
        except ValueError:
            _fail("OPENRAG_DOCUMENT_ID must be a valid UUID")
    else:
        document_id = None

    h = _headers()
    timeout = httpx.Timeout(120.0)

    with httpx.Client(base_url=root, headers=h, timeout=timeout) as client:
        r = client.get("/health")
        if r.status_code != 200:
            _fail(f"GET /health: {r.status_code} {r.text}")
        health = r.json()
        if not health.get("database"):
            _fail("Database unreachable (GET /health database=false)")
        print("OK health + database")

        # --- 1) Chat persistence (sessions + messages) ---
        r = client.post("/chat/sessions", json={})
        if r.status_code != 201:
            _fail(f"POST /chat/sessions: {r.status_code} {r.text}")
        sess_empty = r.json()
        sid_empty = uuid.UUID(sess_empty["id"])

        r = client.get("/chat/sessions")
        if r.status_code != 200:
            _fail(f"GET /chat/sessions: {r.status_code} {r.text}")
        if not any(s["id"] == str(sid_empty) for s in r.json()):
            _fail("New session not listed in GET /chat/sessions")

        r = client.get(f"/chat/sessions/{sid_empty}/messages")
        if r.status_code != 200:
            _fail(f"GET messages: {r.status_code} {r.text}")
        if r.json() != []:
            _fail("Expected no messages on fresh session")

        print("OK chat: create session, list sessions, empty messages")

        if document_id:
            body = {"document_id": str(document_id)}
            r = client.post("/chat/sessions", json=body)
            if r.status_code != 201:
                _fail(f"POST /chat/sessions with document: {r.status_code} {r.text}")
            sess_doc = r.json()
            sid_doc = uuid.UUID(sess_doc["id"])

            r = client.get("/chat/sessions", params={"document_id": str(document_id)})
            if r.status_code != 200:
                _fail(f"GET /chat/sessions?document_id=: {r.status_code} {r.text}")
            if not any(s["id"] == str(sid_doc) for s in r.json()):
                _fail("Document-scoped session not in filtered list")
            print("OK chat: document-scoped session + filter")

        # Optional: full ask + message persistence
        if os.environ.get("OPENRAG_RUN_CHAT_ASK") == "1":
            if not document_id:
                _fail("OPENRAG_RUN_CHAT_ASK=1 requires OPENRAG_DOCUMENT_ID")
            scope = {"document_id": str(document_id)}
            r = client.post(
                "/chat/ask",
                json={
                    "question": "What is this document about? One sentence.",
                    "scope": scope,
                    "mode": "concise_summary",
                },
            )
            if r.status_code != 200:
                _fail(f"POST /chat/ask: {r.status_code} {r.text}")
            data = r.json()
            if "session_id" not in data:
                _fail("ChatAskResponse missing session_id")
            sid_ask = uuid.UUID(data["session_id"])
            r = client.get(f"/chat/sessions/{sid_ask}/messages")
            if r.status_code != 200:
                _fail(f"GET messages after ask: {r.status_code} {r.text}")
            msgs = r.json()
            if len(msgs) < 2:
                _fail(f"Expected at least 2 messages after ask, got {len(msgs)}")
            roles = [m["role"] for m in msgs]
            if "user" not in roles or "assistant" not in roles:
                _fail(f"Unexpected message roles: {roles}")
            print("OK chat: /ask persisted user + assistant rows")

        # --- 2) Quiz attempts (needs existing quiz) ---
        quiz_raw = os.environ.get("OPENRAG_QUIZ_ID")
        if quiz_raw and document_id:
            try:
                qid = uuid.UUID(quiz_raw)
            except ValueError:
                _fail("OPENRAG_QUIZ_ID must be a valid UUID")
            r = client.get(f"/quizzes/{qid}", params={"include_answers": "true"})
            if r.status_code != 200:
                _fail(f"GET /quizzes/{{id}}: {r.status_code} {r.text}")
            quiz = r.json()
            questions: list[dict[str, Any]] = quiz.get("questions") or []
            if not questions:
                _fail("Quiz has no questions; cannot test attempt scoring")
            answers: dict[str, str] = {}
            for q in questions:
                qt = q.get("question_type")
                qid_str = q["id"]
                if qt == "multiple_choice":
                    answers[qid_str] = q.get("correct_answer", "")
                elif qt == "true_false":
                    answers[qid_str] = q.get("correct_answer", "true")
                else:
                    answers[qid_str] = "skip"
            r = client.post(f"/quizzes/{qid}/attempts", json={"answers": answers})
            if r.status_code != 200:
                _fail(f"POST attempts: {r.status_code} {r.text}")
            att = r.json()
            if "attempt_id" not in att or "score" not in att:
                _fail(f"Bad attempt response: {att}")
            r = client.get(f"/quizzes/{qid}/attempts")
            if r.status_code != 200:
                _fail(f"GET attempts: {r.status_code} {r.text}")
            attempts = r.json()
            if not any(a["attempt_id"] == att["attempt_id"] for a in attempts):
                _fail("Submitted attempt not in list")
            print("OK quiz: get quiz, submit attempt, list attempts")
        else:
            print("SKIP quiz HTTP (set OPENRAG_DOCUMENT_ID + OPENRAG_QUIZ_ID to exercise)")

        # --- 3) Highlights CRUD ---
        if document_id:
            r = client.post(
                f"/documents/{document_id}/highlights",
                json={"page_start": 1, "page_end": 1, "quote_text": "self-test quote"},
            )
            if r.status_code != 201:
                _fail(f"POST highlight: {r.status_code} {r.text}")
            hid = uuid.UUID(r.json()["id"])

            r = client.get(f"/documents/{document_id}/highlights")
            if r.status_code != 200:
                _fail(f"GET highlights: {r.status_code} {r.text}")
            if not any(hl["id"] == str(hid) for hl in r.json()):
                _fail("New highlight not in list")

            r = client.patch(
                f"/highlights/{hid}",
                json={"quote_text": "updated quote"},
            )
            if r.status_code != 200:
                _fail(f"PATCH highlight: {r.status_code} {r.text}")
            if r.json().get("quote_text") != "updated quote":
                _fail("PATCH did not update quote_text")

            r = client.delete(f"/highlights/{hid}")
            if r.status_code != 204:
                _fail(f"DELETE highlight: {r.status_code} {r.text}")

            r = client.get(f"/documents/{document_id}/highlights")
            if any(hl["id"] == str(hid) for hl in r.json()):
                _fail("Highlight still listed after delete")
            print("OK highlights: create, list, patch, delete")
        else:
            print("SKIP highlights (set OPENRAG_DOCUMENT_ID)")

        # --- 4) Activity feed ---
        r = client.get("/activity", params={"limit": 20})
        if r.status_code != 200:
            _fail(f"GET /activity: {r.status_code} {r.text}")
        items = r.json()
        if not isinstance(items, list):
            _fail("Activity response is not a list")
        types = {x.get("activity_type") for x in items}
        print("OK activity: list returned", len(items), "rows; types sample:", sorted(types)[:8])

    print("All executed checks passed.")


if __name__ == "__main__":
    main()
