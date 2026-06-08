from dc_core.tenancy import TenantContext
from fastapi.testclient import TestClient

from app.config import get_settings
from app.domain.calls_service import CallsService
from app.domain.memory_store import get_memory_store
from app.main import app

client = TestClient(app)
SECRET = "test-secret"
HEADERS = {
    "X-Internal-Secret": SECRET,
    "x-tenant-id": "tenant-pre-dc",
    "x-user-id": "user-pre-dc",
}


def _clear_memory(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    get_settings.cache_clear()
    store = get_memory_store()
    store.pre_dc_records.clear()
    store.call_briefs.clear()
    store.calls.clear()
    store.agent_configs.clear()


def test_pre_dc_ingest_runs_agent_and_saves_brief(monkeypatch):
    _clear_memory(monkeypatch)
    monkeypatch.setenv("WORKFLOW_AGENT_INGEST_SYNC", "true")

    def fake_relevant_content(_ctx, _account_name, _research):
        return {
            "relevantDocuments": [],
            "relevantProjects": [
                {
                    "id": "proj-legacy-portal",
                    "title": "Legacy Portal Modernization",
                    "source": "project_database",
                    "relevanceScore": 0.91,
                    "summary": "B2B SaaS portal modernization with legacy workflow replacement.",
                    "details": "The project modernized an older portal and aligned discovery around operational workflow gaps.",
                },
                {
                    "id": "proj-onboarding",
                    "title": "Customer Onboarding Workflow",
                    "source": "project_database",
                    "relevanceScore": 0.82,
                    "summary": "Customer onboarding workflow automation for a SaaS company.",
                    "details": "The project improved onboarding workflows and reduced customer friction.",
                }
            ],
        }

    monkeypatch.setattr("app.agents.pre_dc_agent.build_relevant_content", fake_relevant_content)
    get_settings.cache_clear()

    payload = {
        "kind": "pre-dc",
        "records": [
            {
                "id": "pre-agent-1",
                "fields": {
                    "Company Name-PreDC": "Agent Test Co",
                    "Lead Name-PreDC": "Alex",
                    "Industry - PreDC": "SaaS",
                    "Company Description": "Agent Test Co is a B2B SaaS company with an older customer portal. Outreach landed the lead from a cold email campaign.",
                    "Have they described their needs": "Modernize legacy portal. The call was scheduled through a calendar invite.",
                    "Intersection areas b/w tkxel & company": "Legacy portal friction slows customer onboarding.",
                    "Campaign Service - PreDC": "tk",
                    "Discovery Call Date (PKT)": "06/07/2026",
                    "Discovery Call Time (PKT)": "7:00 pm",
                    "Other Information": "Brian responded positively and expressed openness to a call, but later clarified that his initial reply went out before he had bandwidth. After multiple follow-up attempts via email and phone, Brian re-engaged and mentioned that he would need investor funding to move forward, though he expressed strong confidence in revenue potential. Scheduling was discussed, Brian requested an NDA and company details, and the meeting has been confirmed.",
                    "Company Type ICP - PreDC": "B2B SaaS",
                    "ICP Bucket": "Sweet spot",
                },
            }
        ],
    }
    r = client.post("/dc-notes/ingest", json=payload, headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["upserted"] == 1
    assert body["agent_processed"] == 1

    ctx = TenantContext(tenant_id="tenant-pre-dc", user_id="user-pre-dc")
    calls = CallsService().list_calls(ctx)
    assert any(c["accountName"] == "Agent Test Co" for c in calls)

    call = next(c for c in calls if c["accountName"] == "Agent Test Co")
    assert call.get("companyTypeIcp") == "B2B SaaS"
    assert call.get("icpBucket") == "Sweet spot"
    assert call.get("icpMatch") == 0.78

    call_id = call["id"]
    brief = CallsService().get_brief(ctx, call_id)
    assert brief is not None
    assert brief.get("aiSummary")
    assert [s.get("id") for s in brief.get("summarySections", [])] == [
        "customer_profile",
        "customer_pain_points",
        "suggested_action",
        "relevance",
    ]
    titles = {s["id"]: s["title"] for s in brief["summarySections"]}
    assert titles["customer_profile"] == "Profile Summary"
    assert titles["customer_pain_points"] == "Client needs"
    profile = next(s for s in brief["summarySections"] if s["id"] == "customer_profile")["content"]
    assert "Agent Test Co is a B2B SaaS company" in profile
    assert "Modernize legacy portal" in profile
    assert "investor funding to move forward" in profile
    assert "Legacy portal friction slows customer onboarding" not in profile
    assert "Outreach landed" not in profile
    assert "cold email" not in profile
    assert "calendar invite" not in profile
    assert "Brian responded" not in profile
    assert "bandwidth" not in profile
    assert "follow-up attempts" not in profile
    assert "NDA" not in profile
    pain_points = next(s for s in brief["summarySections"] if s["id"] == "customer_pain_points")["content"]
    assert "Legacy portal friction slows customer onboarding" in pain_points
    assert "Modernize legacy portal" not in pain_points
    assert "investor funding to move forward" not in pain_points
    assert "Brian responded" not in pain_points
    suggested_action = next(s for s in brief["summarySections"] if s["id"] == "suggested_action")["content"]
    assert "Legacy portal friction slows customer onboarding" in suggested_action
    assert "tk 06/07/2026 7:00 pm" not in suggested_action
    relevance = next(s for s in brief["summarySections"] if s["id"] == "relevance")["content"]
    assert (
        relevance
        == "Relevant projects done: 2 - Legacy Portal Modernization, Customer Onboarding Workflow. Overall relevance: 91%."
    )
    assert "Agent Test Co is a B2B SaaS company" not in relevance
    assert "Legacy Portal Modernization" in relevance
    assert "Customer Onboarding Workflow" in relevance
    assert "because" not in relevance.lower()
    assert brief.get("artifactPlan")
    assert isinstance(brief.get("artifactPlan"), list)
    assert len(brief["artifactPlan"]) >= 1
    assert brief.get("artifactFulfillment")
    assert brief.get("preDeck")
    assert brief["preDeck"].get("slides")
    assert brief.get("contentToGenerate")
    assert "reason" in brief["contentToGenerate"][0]
    assert "relevantDocuments" in brief
    assert "relevantProjects" in brief
    assert brief.get("agentStatus") == "success"


def test_generate_brief_delegates_to_pre_dc_pipeline(monkeypatch):
    _clear_memory(monkeypatch)

    ingest = {
        "kind": "pre-dc",
        "records": [
            {
                "id": "pre-delegate",
                "fields": {
                    "Company Name-PreDC": "Delegate Corp",
                    "Lead Name-PreDC": "Sam",
                },
            }
        ],
    }
    assert client.post("/dc-notes/ingest", json=ingest, headers=HEADERS).status_code == 200

    ctx_headers = {"x-user-id": "user-pre-dc", "x-tenant-id": "tenant-pre-dc"}
    calls = client.get("/api/v1/calls", headers=ctx_headers).json()
    call_id = next(c["id"] for c in calls if c["accountName"] == "Delegate Corp")

    gen = client.post(f"/api/v1/calls/{call_id}/generate-brief", headers=ctx_headers)
    assert gen.status_code == 200
    result = gen.json().get("result") or gen.json()
    assert result.get("aiSummary")
    assert result.get("artifactPlan")
    pain_points = next(s for s in result["summarySections"] if s["id"] == "customer_pain_points")[
        "content"
    ]
    assert pain_points == "Needs/content is not identified yet."


def test_workflow_config_includes_default_prompts_and_rules(monkeypatch):
    _clear_memory(monkeypatch)
    from app.domain.agent_config_repository import get_agent_config_repository
    from dc_core.tenancy import TenantContext

    repo = get_agent_config_repository()
    ctx = TenantContext(tenant_id="tenant-pre-dc", user_id="user-pre-dc")
    repo.save_config(
        ctx,
        "workflow",
        {
            "workflow_prompts": {"summary": "", "artifact_plan": "", "artifact_fulfill": ""},
            "summary_highlight_rules": [],
        },
    )
    cfg = repo.get_config(ctx, "workflow")
    assert len(cfg.get("summary_highlight_rules") or []) >= 4
    assert (cfg.get("workflow_prompts") or {}).get("summary", "").strip()
    assert (cfg.get("workflow_prompts") or {}).get("artifact_plan", "").strip()
    assert (cfg.get("workflow_prompts") or {}).get("artifact_fulfill", "").strip()


def test_pre_dc_agent_config_includes_prompt_overrides(monkeypatch):
    _clear_memory(monkeypatch)
    ctx_headers = {"x-user-id": "user-pre-dc", "x-tenant-id": "tenant-pre-dc"}

    cfg = client.get("/api/v1/agents/workflow/config", headers=ctx_headers)
    assert cfg.status_code == 200
    data = cfg.json()
    assert data["agent_id"] == "workflow"
    assert "workflow_prompts" in data
    assert "summary_highlight_rules" in data
    assert data["operations"] == ["workflow_pipeline"]
