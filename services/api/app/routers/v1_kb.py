from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_tenant_context
from app.domain.calls_service import CallsService
from app.domain.kb_constants import ALLOWED_ASSET_TYPES, ALLOWED_EXTENSIONS, EXTENSION_MIME
from app.domain.kb_project_repository import get_kb_project, list_kb_projects
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.kb_repository import get_kb_repository
from app.orchestrator.dispatcher import Orchestrator
from app.services.kb_ingest_service import process_ingest_job

router = APIRouter(prefix="/api/v1/kb", tags=["kb"])
_calls = CallsService()
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


@router.get("/assets/{asset_id}/suggestion-stats")
def get_asset_suggestion_stats(
    asset_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    return _calls.asset_suggestion_stats(ctx, asset_id)


@router.get("/projects")
def list_projects(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return list_kb_projects(ctx)


@router.get("/projects/{project_id}")
def get_project(project_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    project = get_kb_project(ctx, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/assets/{asset_id}/preview-text")
def get_asset_preview_text(
    asset_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    texts = get_kb_repository().list_asset_chunk_texts(ctx, asset_id)
    combined = "\n\n".join(texts)
    return {"assetId": asset_id, "text": combined[:12000], "chunkCount": len(texts)}


@router.get("/assets/{asset_id}/preview/slides")
def get_asset_preview_slides_meta(
    asset_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    slide_count = int(row.get("preview_slide_count") or 0)
    if slide_count <= 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide preview not found for asset")
    cache_version = (
        row.get("preview_updated_at")
        or row.get("embedded_at")
        or row.get("uploaded_at")
        or "1"
    )
    return {
        "assetId": asset_id,
        "slideCount": slide_count,
        "cacheVersion": str(cache_version),
    }


@router.get("/assets/{asset_id}/preview/slides/{slide_index}")
def get_asset_preview_slide(
    asset_id: str,
    slide_index: int,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Response:
    if slide_index < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="slide_index must be >= 1")

    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
    slide_count = int((row or {}).get("preview_slide_count") or 0)
    if not row or slide_count <= 0 or slide_index > slide_count:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    from app.services.office_preview import slide_storage_path

    path = slide_storage_path(tenant_uuid, asset_id, slide_index)
    try:
        data = repo.download_file(ctx, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide file not found") from exc

    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "private, no-store, must-revalidate"},
    )


@router.get("/assets/{asset_id}/preview")
def get_asset_preview(asset_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Response:
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
    preview_path = row.get("preview_storage_path") if row else None
    if not row or not preview_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not found for asset")

    try:
        data = repo.download_file(ctx, str(preview_path))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview file not found") from exc

    file_name = row.get("file_name") or "asset"
    stem = Path(file_name).stem
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{stem}-preview.pdf"'},
    )


@router.get("/assets/{asset_id}/file")
def get_asset_file(asset_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Response:
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
    if not row or not row.get("storage_path"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found for asset")

    try:
        data = repo.download_file(ctx, str(row["storage_path"]))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found") from exc

    mime = row.get("mime_type") or "application/octet-stream"
    file_name = row.get("file_name") or "asset"
    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )


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

    try:
        result = repo.create_upload(
            ctx,
            file_name=file_name,
            file_bytes=content,
            ext=ext,
            title=title,
            tags=tag_list,
            asset_type=asset_type,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {exc}",
        ) from exc

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
