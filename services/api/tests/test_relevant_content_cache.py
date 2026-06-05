from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.domain.memory_store import get_memory_store
from app.orchestrator.dispatcher import Orchestrator


def test_get_relevant_content_returns_cached_brief_without_kb_search(monkeypatch):
    ctx = TenantContext(tenant_id="t-rel-cache", user_id="u1")
    call_id = "call-rel-cache"
    orch = Orchestrator()

    def fail_build(*_args, **_kwargs):
        raise AssertionError("build_relevant_content should not run when cache exists")

    monkeypatch.setattr("app.orchestrator.dispatcher.build_relevant_content", fail_build)

    clerk_key = ctx.tenant_id
    get_memory_store().save_call_brief(
        clerk_key,
        call_id,
        {
            "callId": call_id,
            "relevantDocuments": [{"assetId": "a1", "title": "Deck", "relevanceScore": 0.9}],
            "relevantProjects": [],
        },
    )

    out = orch.get_relevant_content(ctx, call_id, refresh=False)
    assert out["cached"] is True
    assert out["relevantDocuments"][0]["title"] == "Deck"


def test_get_relevant_content_refresh_rebuilds(monkeypatch):
    ctx = TenantContext(tenant_id="t-rel-refresh", user_id="u1")
    call_id = "call-rel-refresh"
    orch = Orchestrator()

    clerk_key = ctx.tenant_id
    get_memory_store().save_call_brief(
        clerk_key,
        call_id,
        {
            "callId": call_id,
            "relevantDocuments": [{"assetId": "old", "title": "Old deck", "relevanceScore": 0.5}],
        },
    )

    monkeypatch.setattr(
        "app.orchestrator.dispatcher.build_relevant_content",
        lambda *_a, **_k: {"relevantDocuments": [{"assetId": "new", "title": "New deck", "relevanceScore": 1.0}], "relevantProjects": []},
    )
    monkeypatch.setattr(
        orch,
        "_pre_dc_fields_for_call",
        lambda *_a, **_k: {"Company Name-PreDC": "Acme"},
    )
    monkeypatch.setattr(
        orch.calls,
        "get_call",
        lambda *_a, **_k: {"accountName": "Acme"},
    )

    out = orch.get_relevant_content(ctx, call_id, refresh=True)
    assert out["cached"] is False
    assert out["relevantDocuments"][0]["title"] == "New deck"
