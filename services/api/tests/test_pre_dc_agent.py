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

    payload = {
        "kind": "pre-dc",
        "records": [
            {
                "id": "pre-agent-1",
                "fields": {
                    "Company Name-PreDC": "Agent Test Co",
                    "Lead Name-PreDC": "Alex",
                    "Industry - PreDC": "SaaS",
                    "Have they described their needs": "Modernize legacy portal",
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

    call_id = next(c["id"] for c in calls if c["accountName"] == "Agent Test Co")
    brief = CallsService().get_brief(ctx, call_id)
    assert brief is not None
    assert brief.get("aiSummary")
    assert brief.get("artifactPlan")
    assert isinstance(brief.get("artifactPlan"), list)
    assert len(brief["artifactPlan"]) >= 1
    assert brief.get("artifactFulfillment")
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
