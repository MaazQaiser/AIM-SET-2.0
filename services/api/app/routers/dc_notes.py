from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.deps import verify_internal_secret
from app.domain.calls_service import CallsService
from app.domain.dc_notes_repository import get_dc_notes_repository
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


def _tenant_id(
    x_tenant_id: Optional[str] = Header(default=None, alias="x-tenant-id"),
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> str:
    return (x_tenant_id or f"tenant-{x_user_id or 'internal'}").strip()


def _ctx(tenant_id: str, x_user_id: Optional[str]) -> TenantContext:
    return TenantContext.from_headers(x_user_id or "internal", tenant_id)


def _supabase_error(exc: Exception) -> HTTPException:
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
    except RuntimeError as exc:
        raise _supabase_error(exc) from exc

    return DcNotesResponse(
        pre_dc_records=[row_to_pre_record(row) for row in data["pre_dc_records"]],
        post_dc_records=[row_to_post_record(row) for row in data["post_dc_records"]],
    )


@router.post("/ingest", response_model=IngestResponse, dependencies=[Depends(verify_internal_secret)])
def ingest_dc_notes(
    body: IngestRequest,
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
        except RuntimeError as exc:
            raise _supabase_error(exc) from exc
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
        except RuntimeError as exc:
            raise _supabase_error(exc) from exc

    _calls.sync_from_dc_notes(ctx)
    return IngestResponse(upserted=len(rows), kind=body.kind)
