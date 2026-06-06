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
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if body.status and body.status not in ("open", "in_progress", "resolved", "dismissed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    gap = get_content_gaps_repository().patch_gap(ctx, gap_id, patch)
    if not gap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gap not found")
    return gap
