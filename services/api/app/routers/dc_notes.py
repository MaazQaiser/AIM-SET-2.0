from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status

from app.config import get_settings
from app.deps import verify_internal_secret
from app.domain.calls_service import CallsService, slugify_company
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.orchestrator.dispatcher import Orchestrator
from app.schemas import (
    DcNotesResponse,
    IngestRequest,
    IngestResponse,
    PostDCRecordIn,
    PreDCRecordIn,
    PostDCRecordOut,
    PreDCRecordOut,
    row_to_post_record,
    row_to_pre_record,
)
from dc_core.tenancy import TenantContext

router = APIRouter(prefix="/dc-notes", tags=["dc-notes"])
_calls = CallsService()
_dc = get_dc_notes_repository()
_orch = Orchestrator()


def _run_pre_dc_pipeline_background(
    ctx: TenantContext,
    call_id: str,
    fields: Dict[str, str],
) -> None:
    try:
        _orch.dispatch_pre_dc_pipeline(ctx, call_id, fields, trigger="ingest")
    except Exception:
        # Pipeline failures are persisted on the brief by the orchestrator.
        return


def _tenant_id(
    x_tenant_id: Optional[str] = Header(default=None, alias="x-tenant-id"),
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> str:
    return (x_tenant_id or f"tenant-{x_user_id or 'internal'}").strip()


def _ctx(tenant_id: str, x_user_id: Optional[str]) -> TenantContext:
    return TenantContext.from_headers(x_user_id or "internal", tenant_id)


def _service_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=str(exc),
    )


@router.get("", response_model=DcNotesResponse, dependencies=[Depends(verify_internal_secret)])
def get_dc_notes(
    tenant_id: str = Depends(_tenant_id),
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> DcNotesResponse:
    ctx = _ctx(tenant_id, x_user_id)
    try:
        data = _dc.get_notes(ctx)
    except Exception as exc:
        raise _service_error(exc) from exc

    return DcNotesResponse(
        pre_dc_records=[row_to_pre_record(row) for row in data["pre_dc_records"]],
        post_dc_records=[row_to_post_record(row) for row in data["post_dc_records"]],
    )


@router.post("/ingest", response_model=IngestResponse, dependencies=[Depends(verify_internal_secret)])
def ingest_dc_notes(
    body: IngestRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(_tenant_id),
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> IngestResponse:
    if not body.records:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No records provided")

    ctx = _ctx(tenant_id, x_user_id)
    rows: List[Dict[str, Any]]

    if body.kind == "pre-dc":
        records = [PreDCRecordIn.model_validate(r) for r in body.records]
        rows = [{"id": r.id, "fields": r.fields} for r in records]
        try:
            _dc.upsert_pre_dc(ctx, rows)
        except Exception as exc:
            raise _service_error(exc) from exc
    else:
        records = [PostDCRecordIn.model_validate(r) for r in body.records]
        rows = [
            {
                "id": r.id,
                "matched_call_id": r.matched_call_id,
                "fields": r.fields,
            }
            for r in records
        ]
        try:
            _dc.upsert_post_dc(ctx, rows)
        except Exception as exc:
            raise _service_error(exc) from exc

    try:
        _calls.sync_from_dc_notes(ctx)
    except Exception as exc:
        raise _service_error(exc) from exc

    settings = get_settings()
    agent_processed = 0
    agent_queued = 0
    if body.kind == "pre-dc" and settings.workflow_agent_on_ingest:
        for row in rows:
            fields = {str(k): str(v) for k, v in (row.get("fields") or {}).items()}
            company = (fields.get("Company Name-PreDC") or "").strip()
            if not company:
                continue
            call_id = slugify_company(company)
            if settings.workflow_agent_ingest_sync:
                try:
                    _orch.dispatch_pre_dc_pipeline(ctx, call_id, fields, trigger="ingest")
                    agent_processed += 1
                except Exception:
                    continue
            else:
                background_tasks.add_task(_run_pre_dc_pipeline_background, ctx, call_id, fields)
                agent_queued += 1

    return IngestResponse(
        upserted=len(rows),
        kind=body.kind,
        agent_processed=agent_processed,
        agent_queued=agent_queued,
    )
