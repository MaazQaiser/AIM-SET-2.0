from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.calls_service import CallsService
from app.orchestrator.dispatcher import Orchestrator

router = APIRouter(prefix="/api/v1/calls", tags=["calls"])
_calls = CallsService()
_orch = Orchestrator()


@router.get("")
def list_calls(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return _calls.list_calls(ctx)


@router.get("/{call_id}")
def get_call(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    call = _calls.get_call(ctx, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.get("/{call_id}/brief")
def get_brief(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    brief = _calls.get_brief(ctx, call_id)
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


@router.post("/{call_id}/generate-brief")
def generate_brief(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_pre_dc_brief(ctx, call_id)


@router.post("/{call_id}/post-call")
def post_call_pipeline(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_post_call(ctx, call_id)
