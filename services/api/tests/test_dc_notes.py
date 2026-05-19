from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
SECRET = "test-secret"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


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


def test_dc_notes_requires_supabase(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()

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
    assert r.status_code == 503
    assert "Supabase" in r.json()["detail"]


def test_v1_calls_list_requires_supabase_or_empty(monkeypatch):
    monkeypatch.setenv("INTERNAL_SECRET", SECRET)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()

    r = client.get(
        "/api/v1/calls",
        headers={"x-user-id": "user-test", "x-tenant-id": "tenant-test"},
    )
    assert r.status_code in (200, 503)
