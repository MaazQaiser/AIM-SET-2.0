from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_tenant_context
from app.domain.kb_constants import ALLOWED_ASSET_TYPES, ALLOWED_EXTENSIONS, EXTENSION_MIME
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.kb_repository import get_kb_repository
from app.orchestrator.dispatcher import Orchestrator
from app.services.kb_ingest_service import process_ingest_job

router = APIRouter(prefix="/api/v1/kb", tags=["kb"])
_orch = Orchestrator()


def _run_ingest_job_background(job: Dict[str, Any]) -> None:
    """Run ingest after HTTP response (avoids Vercel proxy timeout on sync ingest)."""
    process_ingest_job(job, get_kb_repository())


class IngestAssetBody(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[List[str]] = None


@router.get("/assets")
def list_assets(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return get_kb_repository().list_assets(ctx)


@router.get("/assets/{asset_id}")
def get_asset(asset_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    asset = get_kb_repository().get_asset(ctx, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


@router.post("/assets")
def ingest_asset_metadata(
    asset: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    return _orch.dispatch_kb_ingest(ctx, asset)


@router.post("/assets/upload")
async def upload_asset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    asset_type: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    settings = get_settings()
    repo = get_kb_repository()

    file_name = file.filename or "upload.bin"
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > settings.kb_max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    if asset_type and asset_type not in ALLOWED_ASSET_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid asset_type. Allowed: {', '.join(sorted(ALLOWED_ASSET_TYPES))}",
        )

    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    mime = file.content_type or EXTENSION_MIME.get(ext, "application/octet-stream")

    result = repo.create_upload(
        ctx,
        file_name=file_name,
        file_bytes=content,
        ext=ext,
        title=title,
        tags=tag_list,
        asset_type=asset_type,
    )

    run_sync = (
        settings.kb_ingest_sync
        or os.environ.get("KB_INGEST_SYNC", "").lower() == "true"
        or not settings.supabase_configured
    )
    if run_sync:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        sync_job = {
            "id": result["job"]["id"],
            "tenant_id": tenant_uuid,
            "asset_id": result["asset"]["id"],
            "_clerk_key": clerk_key,
            "_uploaded_by": ctx.user_id,
        }
        # Defer ingest so Vercel /api/kb/upload returns before parse/embed finish.
        background_tasks.add_task(_run_ingest_job_background, sync_job)

    return result


@router.get("/ingest-jobs/{job_id}")
def get_ingest_job(job_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    job = get_kb_repository().get_job(ctx, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, str]:
    ok = get_kb_repository().delete_asset(ctx, asset_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return {"status": "deleted", "assetId": asset_id}


@router.post("/assets/{asset_id}/re-embed")
def re_embed_asset(
    asset_id: str,
    background_tasks: BackgroundTasks,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    repo = get_kb_repository()
    job = repo.requeue_asset(ctx, asset_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    settings = get_settings()
    if settings.kb_ingest_sync or os.environ.get("KB_INGEST_SYNC", "").lower() == "true":
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        background_tasks.add_task(
            _run_ingest_job_background,
            {
                "id": job["id"],
                "tenant_id": tenant_uuid,
                "asset_id": asset_id,
                "_clerk_key": clerk_key,
            },
        )

    return {"job": job}
