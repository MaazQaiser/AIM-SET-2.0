from __future__ import annotations

from app.domain.content_gaps_repository import ContentGapsRepository
from app.domain.memory_store import get_memory_store
from app.services import content_gaps_service
from app.services.content_gaps_service import sync_gaps_from_brief, sync_gaps_from_post_call
from dc_core.tenancy import TenantContext


def test_sync_gaps_from_brief_upserts_missing_items():
    repo = ContentGapsRepository()
    ctx = TenantContext(tenant_id="test-tenant", user_id="user-1")
    brief = {
        "contentToGenerate": [
            {
                "id": "gap-1",
                "sourceArtifactId": "art-deck",
                "name": "Services overview deck",
                "type": "deck",
                "status": "missing",
                "reason": "No KB match",
                "neededFor": "Call prep",
                "priority": 1,
            }
        ]
    }

    sync_gaps_from_brief(ctx, "call-123", brief)
    gaps = repo.list_gaps(ctx)
    assert len(gaps) == 1
    assert gaps[0]["gapKey"] == "pre_dc:call-123:art-deck"
    assert gaps[0]["status"] == "open"
    assert gaps[0]["name"] == "Services overview deck"


def test_sync_gaps_from_post_call_upserts_missing_attachments():
    repo = ContentGapsRepository()
    ctx = TenantContext(tenant_id="test-tenant-2", user_id="user-1")
    post_result = {
        "emailAttachments": {
            "missing": [
                {"name": "FinTech Case Study", "requiredData": "Promised in follow-up email"},
            ]
        }
    }

    sync_gaps_from_post_call(ctx, "call-456", post_result)
    gaps = repo.list_gaps(ctx)
    assert len(gaps) == 1
    assert gaps[0]["gapKey"] == "post_dc:call-456:fintech case study"
    assert gaps[0]["source"] == "post_dc"


def test_sync_gaps_from_post_call_uses_memory_tenant_fallback(monkeypatch):
    from app.domain import content_gaps_repository as repo_module

    class _MemoryOnlySettings:
        supabase_configured = False

    class _FallbackTenantService:
        def __init__(self) -> None:
            self.allow_values = []

        def resolve(self, _ctx: TenantContext, *, allow_memory_fallback: bool = False):
            self.allow_values.append(allow_memory_fallback)
            if not allow_memory_fallback:
                raise RuntimeError("tenant unavailable")
            return "tenant-fallback", "fallback-clerk"

    tenant_service = _FallbackTenantService()
    get_memory_store().content_gaps.pop("fallback-clerk", None)
    repo_module.get_content_gaps_repository.cache_clear()
    monkeypatch.setattr(repo_module, "get_settings", lambda: _MemoryOnlySettings())
    monkeypatch.setattr(repo_module, "get_tenant_service", lambda: tenant_service)
    repo = repo_module.get_content_gaps_repository()
    monkeypatch.setattr(content_gaps_service, "get_content_gaps_repository", lambda: repo)

    sync_gaps_from_post_call(
        TenantContext(tenant_id="local-dev-user", user_id="user-1"),
        "call-fallback",
        {
            "emailAttachments": {
                "missing": [
                    {"name": "Security architecture overview", "requiredData": "Promised after call"},
                ]
            }
        },
    )

    gaps = repo.list_gaps(TenantContext(tenant_id="local-dev-user", user_id="user-1"))
    assert tenant_service.allow_values
    assert all(tenant_service.allow_values)
    assert gaps[0]["gapKey"] == "post_dc:call-fallback:security architecture overview"
