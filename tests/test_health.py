"""Lightweight health check (DB optional: status may be degraded)."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_health_returns_200(http_client, api_v1_prefix: str) -> None:
    r = await http_client.get(f"{api_v1_prefix}/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "degraded")
