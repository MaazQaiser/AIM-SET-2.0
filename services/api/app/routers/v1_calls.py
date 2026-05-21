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


@router.post("/{call_id}/end-live")
def end_live_call(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_call_end(ctx, call_id)


@router.post("/{call_id}/bot-chat")
def bot_chat(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    return _orch.dispatch_bot_chat(ctx, call_id, message)


@router.get("/{call_id}/suggestions")
def list_suggestions(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    from app.domain.live_call_repository import get_live_call_repository

    return get_live_call_repository().list_suggestions(ctx, call_id)


@router.post("/{call_id}/suggestions/{suggestion_id}/feedback")
def suggestion_feedback(
    call_id: str,
    suggestion_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    from app.domain.live_call_repository import get_live_call_repository

    status = (body.get("status") or "").strip()
    if status not in ("accepted", "dismissed"):
        raise HTTPException(status_code=400, detail="status must be accepted or dismissed")
    updated = get_live_call_repository().update_suggestion_status(ctx, call_id, suggestion_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return updated
