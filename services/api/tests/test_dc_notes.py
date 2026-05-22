from dc_core.tenancy import TenantContext
from fastapi.testclient import TestClient

from app.config import get_settings
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.kb_tenancy import resolve_team_tenant
from app.main import app

client = TestClient(app)
SECRET = "test-secret"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "supabase_configured" in body
    assert "openai_configured" in body
    assert "kb_ingest_sync" in body


def test_dc_notes_ingest_requires_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    from app.config import get_settings

    get_settings.cache_clear()

    r = client.post(
        "/dc-notes/ingest",
        json={"kind": "pre-dc", "records": []},
        headers={"X-Internal-Secret": "wrong"},
    )
    assert r.status_code == 401


def test_dc_notes_ingest_memory_without_supabase(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    from app.config import get_settings
    from app.domain.memory_store import get_memory_store

    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_role_key", "")
    store = get_memory_store()
    store.pre_dc_records.clear()

    payload = {
        "kind": "pre-dc",
        "records": [
            {
                "id": "pre-1",
                "fields": {"Company Name-PreDC": "Acme Corp", "Lead Name-PreDC": "Jane"},
            }
        ],
    }
    r = client.post(
        "/dc-notes/ingest",
        json=payload,
        headers={
            "X-Internal-Secret": SECRET,
            "x-tenant-id": "tenant-test",
            "x-user-id": "user-test",
        },
    )
    assert r.status_code == 200
    assert r.json()["upserted"] == 1

    loaded = client.get(
        "/dc-notes",
        headers={
            "X-Internal-Secret": SECRET,
            "x-tenant-id": "tenant-test",
            "x-user-id": "user-test",
        },
    )
    assert loaded.status_code == 200
    assert len(loaded.json()["pre_dc_records"]) == 1


def test_dc_notes_shared_tenant_when_kb_shared_mode(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_role_key", "")
    monkeypatch.setattr(settings, "kb_shared_mode", True)
    monkeypatch.setattr(settings, "kb_shared_tenant_key", "dc-copilot-shared")

    from app.domain.memory_store import get_memory_store

    store = get_memory_store()
    store.pre_dc_records.pop("dc-copilot-shared", None)

    ctx_a = TenantContext(tenant_id="org-a", user_id="user-a", clerk_org_id="org-a")
    ctx_b = TenantContext(tenant_id="org-b", user_id="user-b", clerk_org_id="org-b")
    uuid_a, key_a = resolve_team_tenant(ctx_a)
    uuid_b, key_b = resolve_team_tenant(ctx_b)
    assert uuid_a == uuid_b
    assert key_a == key_b == "dc-copilot-shared"

    repo = get_dc_notes_repository()
    repo.upsert_pre_dc(
        ctx_a,
        [{"id": "pre-shared", "fields": {"Company Name-PreDC": "Shared Co", "Lead Name-PreDC": "Sam"}}],
    )
    notes = repo.get_notes(ctx_b)
    assert len(notes["pre_dc_records"]) == 1
    assert notes["pre_dc_records"][0]["id"] == "pre-shared"


def test_v1_calls_list_memory_fallback(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()

    r = client.get(
        "/api/v1/calls",
        headers={"x-user-id": "user-test", "x-tenant-id": "tenant-test"},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)
