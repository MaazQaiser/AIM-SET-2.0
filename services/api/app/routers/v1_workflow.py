from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.calls_service import slugify_company
from app.orchestrator.dispatcher import Orchestrator

router = APIRouter(prefix="/api/v1/workflow", tags=["workflow"])
_orch = Orchestrator()


@router.post("/run")
def run_workflow_for_call(
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    call_id = str(body.get("call_id") or body.get("callId") or "").strip()
    if not call_id:
        raise HTTPException(status_code=400, detail="call_id is required")

    fields = _orch._pre_dc_fields_for_call(ctx, call_id)
    if not fields:
        raise HTTPException(status_code=404, detail="No Pre-DC record found for this call")

    try:
        return _orch.dispatch_pre_dc_pipeline(ctx, call_id, fields, trigger="manual")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/run-from-record")
def run_workflow_from_record(
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    record = body.get("record") or {}
    fields = record.get("fields") if isinstance(record, dict) else None
    if not isinstance(fields, dict):
        raise HTTPException(status_code=400, detail="record.fields is required")

    company = str(fields.get("Company Name-PreDC") or "").strip()
    if not company:
        raise HTTPException(status_code=400, detail="Company Name-PreDC is required")

    call_id = str(body.get("call_id") or body.get("callId") or slugify_company(company))
    str_fields = {str(k): str(v) for k, v in fields.items()}
    try:
        return _orch.dispatch_pre_dc_pipeline(ctx, call_id, str_fields, trigger="manual")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
