from __future__ import annotations

from functools import lru_cache
from typing import Optional

from fastapi import Header, HTTPException, status
from supabase import Client, create_client

from dc_core.tenancy import TenantContext

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def verify_internal_secret(
    x_internal_secret: Optional[str] = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    settings = get_settings()
    if not settings.internal_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_SECRET is not configured on the API service",
        )
    expected = (settings.internal_secret or "").strip()
    provided = (x_internal_secret or "").strip()
    if provided != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal secret")


def get_tenant_context(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
    x_tenant_id: Optional[str] = Header(default=None, alias="x-tenant-id"),
    x_clerk_org_id: Optional[str] = Header(default=None, alias="x-clerk-org-id"),
) -> TenantContext:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing x-user-id")
    return TenantContext.from_headers(x_user_id, x_tenant_id, x_clerk_org_id)
