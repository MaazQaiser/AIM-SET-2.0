from __future__ import annotations

from datetime import date

from dc_core.tenancy import TenantContext
from fastapi.testclient import TestClient

from app.domain.daily_briefings_repository import get_daily_briefings_repository
from app.domain.memory_store import get_memory_store
from app.main import app

client = TestClient(app)
CTX = TenantContext(tenant_id="t-brief-cache", user_id="u1")


def test_daily_briefing_post_caches_without_refresh(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "")
    from app.config import get_settings

    get_settings.cache_clear()
    get_memory_store().daily_briefings.clear()

    body = {"todaysCallCount": 0, "pendingApprovalCount": 0}
    day = date.today().isoformat()

    first = client.post(
        "/api/v1/agents/briefing",
        json=body,
        headers={"x-tenant-id": CTX.tenant_id, "x-user-id": CTX.user_id},
    )
    assert first.status_code == 200
    assert first.json()["cached"] is False
    assert first.json()["paragraph"]

    second = client.post(
        "/api/v1/agents/briefing",
        json=body,
        headers={"x-tenant-id": CTX.tenant_id, "x-user-id": CTX.user_id},
    )
    assert second.status_code == 200
    assert second.json()["cached"] is True
    assert second.json()["paragraph"] == first.json()["paragraph"]

    cached_get = client.get(
        f"/api/v1/agents/briefing?date={day}",
        headers={"x-tenant-id": CTX.tenant_id, "x-user-id": CTX.user_id},
    )
    assert cached_get.status_code == 200
    assert cached_get.json()["cached"] is True


def test_daily_briefing_refresh_regenerates(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "")
    from app.config import get_settings

    get_settings.cache_clear()
    repo = get_daily_briefings_repository()
    get_memory_store().daily_briefings.clear()

    body = {"todaysCallCount": 1, "pendingApprovalCount": 0}
    repo.save(
        CTX,
        date.today().isoformat(),
        {"paragraph": "Stored paragraph", "source": "template", "model": None, "context": body},
    )

    refreshed = client.post(
        "/api/v1/agents/briefing?refresh=true",
        json=body,
        headers={"x-tenant-id": CTX.tenant_id, "x-user-id": CTX.user_id},
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["cached"] is False
    assert refreshed.json()["paragraph"] != "Stored paragraph"
