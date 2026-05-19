from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.memory_store import get_memory_store

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


@router.get("/runs")
def list_agent_runs(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return get_memory_store().agent_runs.get(ctx.tenant_id, [])


@router.get("/audit")
def list_audit(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return get_memory_store().audit.get(ctx.tenant_id, [])
