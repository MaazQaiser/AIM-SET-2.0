from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.content_gaps_repository import get_content_gaps_repository

router = APIRouter(prefix="/api/v1/content", tags=["content-gaps"])


class GapPatchBody(BaseModel):
    status: Optional[str] = None
    studioProjectId: Optional[str] = None
    kbAssetId: Optional[str] = None
    source: Optional[str] = None
    name: Optional[str] = None
    artifactType: Optional[str] = None
    callId: Optional[str] = None
    reason: Optional[str] = None
    neededFor: Optional[str] = None
    sourcePath: Optional[str] = None
    contentRequirements: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)
    priority: Optional[int] = None


def _normalize_source(value: Optional[str]) -> str:
    return "post_dc" if str(value or "").replace("_", "-") == "post-dc" else "pre_dc"


def _patch_fields(body: GapPatchBody) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if body.status is not None:
        out["status"] = body.status
    if body.studioProjectId is not None:
        out["studioProjectId"] = body.studioProjectId
    if body.kbAssetId is not None:
        out["kbAssetId"] = body.kbAssetId
    if body.sourcePath is not None:
        out["sourcePath"] = body.sourcePath
    if body.context:
        out["context"] = body.context
    return out


@router.get("/gaps")
def list_gaps(
    status: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
) -> List[Dict[str, Any]]:
    return get_content_gaps_repository().list_gaps(ctx, status=status)


@router.patch("/gaps/{gap_id}")
def patch_gap(
    gap_id: str,
    body: GapPatchBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    patch = _patch_fields(body)
    if not patch:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if body.status and body.status not in ("open", "in_progress", "resolved", "dismissed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    repo = get_content_gaps_repository()
    gap = repo.patch_gap(ctx, gap_id, patch)
    if not gap and body.source and body.name:
        created = repo.upsert_gap(
            ctx,
            gap_key=gap_id,
            source=_normalize_source(body.source),
            name=body.name,
            artifact_type=body.artifactType or "deck",
            call_id=body.callId,
            reason=body.reason,
            needed_for=body.neededFor,
            source_path=body.sourcePath,
            context={
                **body.context,
                **({"contentRequirements": body.contentRequirements} if body.contentRequirements else {}),
            },
            priority=body.priority or 2,
        )
        gap = repo.patch_gap(ctx, str(created["id"]), patch) or created
    if not gap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gap not found")
    return gap
