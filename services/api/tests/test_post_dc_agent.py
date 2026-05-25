from dc_core.tenancy import TenantContext
from fastapi.testclient import TestClient

from app.agents.post_dc_agent import run_post_dc_pipeline
from app.config import get_settings
from app.domain.calls_service import CallsService
from app.domain.memory_store import get_memory_store
from app.main import app
from app.orchestrator.dispatcher import Orchestrator
from app.agents import live_call_session as agent_live_call_session
from app.domain import live_call_session as domain_live_call_session

client = TestClient(app)


def _clear_memory(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    store = get_memory_store()
    store.calls.clear()
    store.call_briefs.clear()
    store.call_post_reviews.clear()
    store.call_live_signals.clear()
    store.discovery_checklists.clear()
    store.live_sessions.clear()
    store.live_suggestions.clear()
    store.transcript_events.clear()
    store.agent_configs.clear()
    store.agent_runs.clear()
    store.audit.clear()
    agent_live_call_session._SESSIONS.clear()
    domain_live_call_session._sessions.clear()


def _discovery_snapshot():
    return {
        "result": {
            "callId": "call-post-agent",
            "checklist": {"bantCoverage": 0.5},
            "bantProgression": {
                "before": {"budget": "unknown", "authority": "unknown", "need": "partial", "timeline": "unknown"},
                "after": {"budget": "unknown", "authority": "partial", "need": "confirmed", "timeline": "partial"},
                "delta": 2,
                "isQualifying": False,
            },
            "openGaps": ["budget", "authority"],
        }
    }


def _qualifying_discovery_snapshot():
    return {
        "result": {
            "callId": "call-post-agent",
            "checklist": {"bantCoverage": 1.0},
            "bantProgression": {
                "before": {"budget": "partial", "authority": "partial", "need": "partial", "timeline": "partial"},
                "after": {"budget": "confirmed", "authority": "confirmed", "need": "confirmed", "timeline": "confirmed"},
                "delta": 4,
                "isQualifying": True,
            },
            "openGaps": [],
        }
    }


def test_post_dc_agent_heuristic_result_shape(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Post Agent Co", "leadEmail": "buyer@example.com"},
        pre_dc_fields={
            "Company Name-PreDC": "Post Agent Co",
            "Industry - PreDC": "SaaS",
            "Have they described their needs": "Modernize the partner portal",
        },
        discovery_snapshot=_discovery_snapshot(),
        transcript_events=[
            {
                "speaker_name": "AE",
                "text": "I will send the case study and follow up with a technical workshop.",
            }
        ],
    )

    assert env.agent == "post_dc"
    assert env.operation == "review_produced"
    assert env.result["review"]["headline"]
    assert env.result["review"]["openDiscoveryGaps"] == ["budget", "authority"]
    assert env.result["task"]["emailDraft"]["to"] == ["buyer@example.com"]
    assert "attachments" in env.result["task"]["emailDraft"]
    assert env.result["task"]["crmTasks"]


def test_post_dc_agent_generates_jira_draft_for_qualified_call(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")

    env = run_post_dc_pipeline(
        ctx,
        "call-post-agent",
        call={"id": "call-post-agent", "accountName": "Qualified Co"},
        pre_dc_fields={"Company Name-PreDC": "Qualified Co", "Campaign Service - PreDC": "AI platform"},
        discovery_snapshot=_qualifying_discovery_snapshot(),
    )

    ticket = env.result["jiraTicket"]
    assert ticket is not None
    assert ticket["status"] == "draft_pending_approval"
    assert ticket["projectKey"] == "SALES"


def test_post_call_route_persists_review(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    CallsService().sync_from_dc_notes(ctx)
    get_memory_store().upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": "call-post-agent",
                "accountName": "Post Agent Co",
                "status": "live",
                "briefReady": False,
                "pod": [],
            }
        ],
    )

    headers = {"x-user-id": "user-post-dc", "x-tenant-id": "tenant-post-dc"}
    post = client.post("/api/v1/calls/call-post-agent/post-call", headers=headers)
    assert post.status_code == 200
    body = post.json()
    assert body["review"]["headline"]
    assert body["task"]["emailDraft"]["status"] == "draft_pending_approval"

    saved = CallsService().get_post_review(ctx, "call-post-agent")
    assert saved is not None
    assert saved["review"]["headline"] == body["review"]["headline"]

    fetched = client.get("/api/v1/calls/call-post-agent/post-call", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["review"]["headline"] == body["review"]["headline"]


def test_live_call_inputs_flow_into_post_dc_review(monkeypatch):
    _clear_memory(monkeypatch)
    ctx = TenantContext(tenant_id="tenant-post-dc", user_id="user-post-dc")
    call_id = "call-live-to-post"
    store = get_memory_store()
    store.upsert_calls(
        "tenant-post-dc",
        [
            {
                "id": call_id,
                "accountName": "Live Signal Co",
                "leadEmail": "buyer@example.com",
                "status": "live",
                "briefReady": False,
                "pod": [],
                "bant": {
                    "budget": "unknown",
                    "authority": "unknown",
                    "need": "partial",
                    "timeline": "unknown",
                },
            }
        ],
    )

    orchestrator = Orchestrator()
    orchestrator.dispatch_live_segment(
        ctx,
        call_id,
        {
            "id": "seg-1",
            "speakerId": "buyer-1",
            "speakerName": "Buyer",
            "speakerRole": "customer",
            "text": "Budget is approved, the CFO owns the decision, and we need launch before the Q3 deadline.",
            "timestamp": 60,
        },
        elapsed_seconds=60,
    )

    post = orchestrator.dispatch_post_call(ctx, call_id)

    live_signals = post["live_signals"]
    assert live_signals["intent"]["label"] == "commercial_discovery"
    assert live_signals["top_keywords"]
    assert "Budget & commercial discovery" in live_signals["focus_areas"]
    assert any(
        "Dominant live-call intent: commercial_discovery." == item
        for item in post["review"]["summary"]
    )
    assert any(item.startswith("Focus areas:") for item in post["review"]["summary"])
    assert post["envelope"]["citations"][0]["source_type"] == "transcript"
    assert "Budget is approved" in post["envelope"]["citations"][0]["snippet"]
    assert any(
        "Budget & commercial discovery" in item
        for item in post["task"]["emailDraft"]["commitments_referenced"]
    )

    saved = CallsService().get_post_review(ctx, call_id)
    assert saved is not None
    assert saved["review"]["headline"] == post["review"]["headline"]
    assert store.call_live_signals["tenant-post-dc"][call_id]["intent"]["label"] == "commercial_discovery"


def test_jira_route_fails_closed_when_unconfigured(monkeypatch):
    _clear_memory(monkeypatch)
    headers = {"x-user-id": "user-post-dc", "x-tenant-id": "tenant-post-dc"}
    res = client.post(
        "/api/v1/integrations/jira/tickets",
        json={"summary": "Draft", "description": "Body", "projectKey": "SALES", "issueType": "Review"},
        headers=headers,
    )
    assert res.status_code == 503
