from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.clp_service import get_clp_service

router = APIRouter(prefix="/api/v1", tags=["clp-notifications"])
_svc = get_clp_service()


@router.get("/notifications")
def list_notifications(
    unread_only: bool = False,
    ctx: TenantContext = Depends(get_tenant_context),
) -> List[Dict[str, Any]]:
    return _svc.list_notifications(ctx, unread_only=unread_only)


@router.patch("/notifications/{notification_id}/read")
def mark_read(notification_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, str]:
    _svc.mark_notification_read(ctx, notification_id)
    return {"ok": "true"}


@router.get("/analytics/landing-pages")
def org_landing_analytics(ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _svc.org_analytics(ctx)
