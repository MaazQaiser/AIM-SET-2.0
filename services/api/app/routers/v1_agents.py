from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.agent_config_defaults import AGENT_IDS
from app.domain.agent_config_repository import get_agent_config_repository
from app.domain.agent_runs_repository import get_agent_runs_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


class AgentConfigBody(BaseModel):
    config: Dict[str, Any]


@router.get("/runs")
def list_agent_runs(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return get_agent_runs_repository().list_runs(ctx)


@router.get("/audit")
def list_audit(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    _, clerk_key = resolve_kb_tenant(ctx)
    events = get_memory_store().audit.get(clerk_key, [])
    normalized: List[Dict[str, Any]] = []
    for ev in events:
        normalized.append(
            {
                "id": ev.get("id", ""),
                "agent": ev.get("agent") or ev.get("agent_id", ""),
                "action": ev.get("action", ""),
                "trace_id": ev.get("trace_id", ""),
                "created_at": ev.get("created_at", ""),
                "payload": ev.get("payload") or {},
            }
        )
    return normalized


@router.get("/{agent_id}/config")
def get_agent_config(
    agent_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    if agent_id not in AGENT_IDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")
    try:
        return get_agent_config_repository().get_config(ctx, agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{agent_id}/config")
def put_agent_config(
    agent_id: str,
    body: AgentConfigBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    if agent_id not in AGENT_IDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")
    try:
        return get_agent_config_repository().save_config(ctx, agent_id, body.config)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
