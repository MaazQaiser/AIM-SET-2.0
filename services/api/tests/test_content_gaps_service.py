from __future__ import annotations

from app.domain.content_gaps_repository import ContentGapsRepository
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
