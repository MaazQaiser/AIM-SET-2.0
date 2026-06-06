from __future__ import annotations

from app.domain.content_gaps_repository import ContentGapsRepository
from app.domain.memory_store import get_memory_store
from app.services import content_gaps_service
from app.services.content_gaps_service import (
    sync_gaps_from_brief,
    sync_gaps_from_post_call,
    upsert_gap_from_studio_brief,
)
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
    assert gaps[0]["sourcePath"] == "/calls/call-123"
    assert gaps[0]["context"]["sourcePath"] == "/calls/call-123"
    assert gaps[0]["context"]["whatToCreate"] == "No KB match"


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
    assert gaps[0]["sourcePath"] == "/calls/call-456/post-dc"
    assert gaps[0]["context"]["neededFor"] == "Post-call follow-up and email attachments"


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


def test_upsert_gap_from_studio_brief_links_project_and_context():
    from app.domain import content_gaps_repository as repo_module

    repo_module.get_content_gaps_repository.cache_clear()
    repo = repo_module.get_content_gaps_repository()
    ctx = TenantContext(tenant_id="test-tenant-3", user_id="user-1")
    gap = upsert_gap_from_studio_brief(
        ctx,
        gap_key="pre_dc:call-789:art-case",
        project_id="11111111-1111-1111-1111-111111111111",
        title="Healthcare case study",
        artifact_type="deck",
        call_id="call-789",
        brief={
            "source": "pre-dc",
            "account_name": "Acme Health",
            "generation_reason": "No strong healthcare proof point exists.",
            "needed_for": "Pre-call prep",
            "content_requirements": "Create a healthcare proof deck with project evidence.",
            "industry": "Healthcare",
        },
    )

    assert gap["status"] == "in_progress"
    assert gap["studioProjectId"] == "11111111-1111-1111-1111-111111111111"
    assert gap["sourcePath"] == "/calls/call-789"
    assert gap["context"]["whatToCreate"] == "Create a healthcare proof deck with project evidence."
    assert repo.get_gap(ctx, "pre_dc:call-789:art-case")["id"] == gap["id"]
