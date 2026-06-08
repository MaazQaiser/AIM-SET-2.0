from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.tenant_service import TenantService


def test_resolve_raises_when_supabase_fails_instead_of_orphan_uuid(monkeypatch):
    monkeypatch.setattr("app.domain.tenant_service.get_settings", lambda: get_settings())
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-key")

    svc = TenantService()

    def _fail(*_args, **_kwargs):
        raise RuntimeError("supabase unavailable")

    monkeypatch.setattr("app.domain.tenant_service.get_supabase", _fail)

    ctx = TenantContext(tenant_id="org-missing", user_id="u1", clerk_org_id="org-missing")
    try:
        svc.resolve(ctx)
        assert False, "expected RuntimeError"
    except RuntimeError as exc:
        assert "Could not resolve tenant" in str(exc)


def test_resolve_can_use_memory_fallback_for_reads(monkeypatch):
    monkeypatch.setattr("app.domain.tenant_service.get_settings", lambda: get_settings())
    settings = get_settings()
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-key")

    svc = TenantService()

    def _fail(*_args, **_kwargs):
        raise RuntimeError("supabase unavailable")

    monkeypatch.setattr("app.domain.tenant_service.get_supabase", _fail)

    ctx = TenantContext(tenant_id="org-missing", user_id="u1", clerk_org_id="org-missing")
    tenant_uuid, clerk_key = svc.resolve(ctx, allow_memory_fallback=True)

    assert clerk_key == "org-missing"
    assert tenant_uuid
