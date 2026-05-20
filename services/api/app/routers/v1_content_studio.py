from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.content_studio_repository import ARTIFACT_TYPES, TEMPLATE_EXTENSIONS, get_content_studio_repository
from app.orchestrator.dispatcher import Orchestrator

router = APIRouter(prefix="/api/v1/content", tags=["content-studio"])
_orch = Orchestrator()


class CreateProjectBody(BaseModel):
    title: str
    artifactType: str


class StudioMessageBody(BaseModel):
    message: str
    templateId: Optional[str] = None
    generate: bool = False


class ExportBody(BaseModel):
    revisionId: str
    format: str


@router.get("/templates")
def list_templates(
    artifact_type: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
) -> List[Dict[str, Any]]:
    return get_content_studio_repository().list_templates(ctx, artifact_type=artifact_type)


@router.get("/templates/{template_id}")
def get_template(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    tpl = get_content_studio_repository().get_template(ctx, template_id)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return tpl


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, str]:
    ok = get_content_studio_repository().delete_template(ctx, template_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return {"status": "deleted", "templateId": template_id}


@router.post("/templates/upload")
async def upload_template(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    artifact_type: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    file_name = file.filename or "upload.bin"
    ext = Path(file_name).suffix.lower()
    if ext not in TEMPLATE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(TEMPLATE_EXTENSIONS))}",
        )
    content = await file.read()
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    result = _orch.dispatch_template_ingest(
        ctx,
        file_name=file_name,
        file_bytes=content,
        ext=ext,
        name=name,
        artifact_type=artifact_type,
        tags=tag_list,
    )
    return result


@router.get("/studio/projects")
def list_projects(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return get_content_studio_repository().list_projects(ctx)


@router.post("/studio/projects")
def create_project(
    body: CreateProjectBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    if body.artifactType not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")
    return get_content_studio_repository().create_project(
        ctx,
        title=body.title,
        artifact_type=body.artifactType,
    )


@router.get("/studio/projects/{project_id}")
def get_project(
    project_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    project = get_content_studio_repository().get_project(ctx, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    messages = get_content_studio_repository().list_messages(ctx, project_id)
    revisions = get_content_studio_repository().list_revisions(ctx, project_id)
    latest = get_content_studio_repository().latest_revision(ctx, project_id)
    return {"project": project, "messages": messages, "revisions": revisions, "latestRevision": latest}


@router.delete("/studio/projects/{project_id}")
def delete_project(
    project_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, str]:
    ok = get_content_studio_repository().delete_project(ctx, project_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return {"status": "deleted", "projectId": project_id}


@router.post("/studio/projects/{project_id}/messages")
def post_message(
    project_id: str,
    body: StudioMessageBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    try:
        return _orch.dispatch_studio_turn(
            ctx,
            project_id,
            body.message,
            template_id=body.templateId,
            allow_generation=body.generate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/studio/projects/{project_id}/revisions/{revision_id}")
def get_revision(
    project_id: str,
    revision_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    rev = get_content_studio_repository().get_revision(ctx, revision_id)
    if not rev or rev.get("projectId") != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")
    return rev


@router.post("/studio/projects/{project_id}/export")
def export_project(
    project_id: str,
    body: ExportBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    project = get_content_studio_repository().get_project(ctx, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    try:
        return _orch.dispatch_studio_export(ctx, body.revisionId, body.format)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
