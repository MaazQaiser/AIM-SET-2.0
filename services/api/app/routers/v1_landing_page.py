from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.clp_service import get_clp_service

router = APIRouter(prefix="/api/v1/calls", tags=["landing-page"])
_svc = get_clp_service()


@router.get("/{call_id}/landing-page")
def get_landing_page(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    page = _svc.get(ctx, call_id)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return page


@router.post("/{call_id}/landing-page/generate")
def generate_landing_page(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    try:
        return _svc.generate_draft(ctx, call_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{call_id}/landing-page")
def patch_landing_page(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    try:
        return _svc.update(ctx, call_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{call_id}/landing-page/publish")
def publish_landing_page(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    password = str(body.get("password") or "").strip()
    try:
        return _svc.publish(ctx, call_id, password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{call_id}/landing-page/revoke")
def revoke_landing_page(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _svc.revoke(ctx, call_id)


@router.get("/{call_id}/landing-page/activity")
def landing_page_activity(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    try:
        return _svc.activity(ctx, call_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{call_id}/landing-page/proposal/generate")
def generate_proposal(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    try:
        return _svc.generate_proposal(ctx, call_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{call_id}/landing-page/proposal")
def get_proposal(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    proposal = _svc.get_proposal(ctx, call_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


@router.post("/{call_id}/landing-page/chat/reply")
def ae_chat_reply(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    from app.domain.clp_repository import get_clp_repository

    page = _svc.get(ctx, call_id)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    msg = get_clp_repository().add_chat_message(
        page["id"],
        visitor_id=str(body.get("visitorId") or ""),
        author_type="ae",
        author_name=str(body.get("authorName") or "Account team"),
        body=str(body.get("body") or "").strip(),
    )
    return msg
