from __future__ import annotations

from typing import Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.tenant_service import get_tenant_service


def resolve_kb_tenant(ctx: TenantContext) -> Tuple[str, str]:
    """
    Resolve (tenant_uuid, clerk_key) for KB operations.
    When KB_SHARED_MODE is on, all users share one tenant so the library syncs across logins.
    """
    settings = get_settings()
    if settings.kb_shared_mode:
        key = settings.kb_shared_tenant_key.strip() or "dc-copilot-shared"
        shared = TenantContext(tenant_id=key, user_id=ctx.user_id, clerk_org_id=key)
        return get_tenant_service().resolve(shared)
    return get_tenant_service().resolve(ctx)


def kb_context_for_user(user_id: str, clerk_org_id: str | None = None) -> TenantContext:
    """Build TenantContext from Clerk ids (BFF / agents)."""
    if get_settings().kb_shared_mode:
        key = get_settings().kb_shared_tenant_key.strip() or "dc-copilot-shared"
        return TenantContext(tenant_id=key, user_id=user_id, clerk_org_id=key)
    tid = clerk_org_id or user_id
    return TenantContext(tenant_id=tid, user_id=user_id, clerk_org_id=clerk_org_id)
