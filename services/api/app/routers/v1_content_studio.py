from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.content_studio_repository import ARTIFACT_TYPES, TEMPLATE_EXTENSIONS, get_content_studio_repository
from app.orchestrator.dispatcher import Orchestrator
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.services.content_export_service import render_html_export
from app.services.kb_ingest_service import process_ingest_job
from app.services.template_editor_service import (
    assist_template_edit,
    build_template_document,
    count_template_pages,
    extract_css_variables,
    split_template_parts,
    validate_template_html,
)
from app.services.template_ingest_service import ensure_template_preview_slides

router = APIRouter(prefix="/api/v1/content", tags=["content-studio"])
_orch = Orchestrator()


class CreateProjectBody(BaseModel):
    title: str
    artifactType: str
    templateId: Optional[str] = None
    brief: Dict[str, Any] = Field(default_factory=dict)
    recommendedTemplateIds: List[str] = Field(default_factory=list)
    callId: Optional[str] = None
    gapId: Optional[str] = None


class StudioMessageBody(BaseModel):
    message: str
    templateId: Optional[str] = None
    generate: bool = False


class ExportBody(BaseModel):
    revisionId: str
    format: str


class SaveRevisionToKbBody(BaseModel):
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    format: str = "pdf"


class TemplateBody(BaseModel):
    name: str
    artifactType: str
    html: str
    css: str = ""
    tags: List[str] = Field(default_factory=list)


class TemplatePatchBody(BaseModel):
    name: Optional[str] = None
    artifactType: Optional[str] = None
    html: Optional[str] = None
    css: Optional[str] = None
    tags: Optional[List[str]] = None


class TemplateAssistBody(BaseModel):
    name: str = "Untitled template"
    artifactType: str = "deck"
    html: str
    css: str = ""
    instruction: str


@router.get("/templates")
def list_templates(
    artifact_type: Optional[str] = None,
    ctx: TenantContext = Depends(get_tenant_context),
) -> List[Dict[str, Any]]:
    return get_content_studio_repository().list_templates(ctx, artifact_type=artifact_type)


@router.post("/templates")
def create_template(
    body: TemplateBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    if body.artifactType not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template name is required")
    try:
        validate_template_html(body.html, body.css)
        document = build_template_document(body.html, body.css)
        _, extracted_css = split_template_parts(body.html)
        css_text = body.css or extracted_css
        return get_content_studio_repository().create_manual_template(
            ctx,
            name=name,
            artifact_type=body.artifactType,
            tags=body.tags,
            html=document,
            css_variables=extract_css_variables(css_text),
            page_count=count_template_pages(document, body.artifactType),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/templates/assist")
def assist_template(
    body: TemplateAssistBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    if body.artifactType not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")
    try:
        return assist_template_edit(
            ctx,
            name=body.name,
            artifact_type=body.artifactType,
            html=body.html,
            css=body.css,
            instruction=body.instruction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/templates/{template_id}")
def get_template(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    tpl = get_content_studio_repository().get_template(ctx, template_id)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return tpl


@router.get("/templates/{template_id}/file")
def get_template_source_file(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Response:
    repo = get_content_studio_repository()
    try:
        data, file_name, mime_type = repo.get_template_source_file(ctx, template_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template file not found") from exc

    return Response(
        content=data,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )


@router.get("/templates/{template_id}/slides/{slide_index}")
def get_template_preview_slide(
    template_id: str,
    slide_index: int,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Response:
    if slide_index < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="slide_index must be >= 1")

    repo = get_content_studio_repository()
    row = repo.get_template_row(ctx, template_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    slide_count = int(row.get("page_count") or 0)
    if slide_count <= 0 or slide_index > slide_count:
        slide_count = ensure_template_preview_slides(ctx, template_id)
        if slide_count <= 0 or slide_index > slide_count:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    try:
        data = repo.download_template_slide(ctx, template_id, slide_index)
    except FileNotFoundError as exc:
        rebuilt = ensure_template_preview_slides(ctx, template_id)
        if rebuilt <= 0 or slide_index > rebuilt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide file not found") from exc
        try:
            data = repo.download_template_slide(ctx, template_id, slide_index)
        except FileNotFoundError as retry_exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide file not found") from retry_exc

    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/templates/{template_id}/preview")
def get_template_preview_pdf(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Response:
    repo = get_content_studio_repository()
    data = repo.get_template_preview_pdf(ctx, template_id)
    if not data:
        rebuilt = ensure_template_preview_slides(ctx, template_id)
        data = repo.get_template_preview_pdf(ctx, template_id)
        if not data and rebuilt <= 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not found")
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not found")

    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="template-preview.pdf"'},
    )


@router.patch("/templates/{template_id}")
def update_template(
    template_id: str,
    body: TemplatePatchBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    existing = get_content_studio_repository().get_template(ctx, template_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    artifact_type = body.artifactType or existing.get("artifactType") or "deck"
    if artifact_type not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")

    patch: Dict[str, Any] = {}
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template name is required")
        patch["name"] = name
    if body.artifactType is not None:
        patch["artifactType"] = body.artifactType
    if body.tags is not None:
        patch["tags"] = body.tags
    if body.html is not None or body.css is not None:
        html = body.html if body.html is not None else existing.get("html") or ""
        _, existing_css = split_template_parts(existing.get("html") or "")
        css = body.css if body.css is not None else existing_css
        try:
            validate_template_html(html, css)
            document = build_template_document(html, css)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        patch["html"] = document
        patch["cssVariables"] = extract_css_variables(css)
        patch["pageCount"] = count_template_pages(document, artifact_type)

    tpl = get_content_studio_repository().update_template(ctx, template_id, patch)
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
    project = get_content_studio_repository().create_project(
        ctx,
        title=body.title,
        artifact_type=body.artifactType,
        template_id=body.templateId,
        brief=body.brief,
        recommended_template_ids=body.recommendedTemplateIds,
        call_id=body.callId,
        source_gap_id=body.gapId,
    )
    _link_gap_to_project(ctx, body.gapId, str(project["id"]))
    return project


def _link_gap_to_project(ctx: TenantContext, gap_ref: Optional[str], project_id: str) -> None:
    if not gap_ref:
        return
    from app.domain.content_gaps_repository import get_content_gaps_repository

    repo = get_content_gaps_repository()
    gap = repo.get_gap(ctx, gap_ref)
    if gap:
        repo.patch_gap(
            ctx,
            str(gap["id"]),
            {"status": "in_progress", "studioProjectId": project_id},
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


@router.post("/studio/projects/{project_id}/bootstrap")
def bootstrap_project(
    project_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    try:
        return _orch.dispatch_studio_bootstrap(ctx, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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


@router.post("/studio/projects/{project_id}/revisions/{revision_id}/restore")
def restore_revision(
    project_id: str,
    revision_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    restored = get_content_studio_repository().restore_revision(ctx, project_id, revision_id)
    if not restored:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")
    return restored


@router.post("/studio/projects/{project_id}/revisions/{revision_id}/save-to-kb")
def save_revision_to_kb(
    project_id: str,
    revision_id: str,
    body: SaveRevisionToKbBody,
    background_tasks: BackgroundTasks,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    repo = get_content_studio_repository()
    project = repo.get_project(ctx, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    revision = repo.get_revision(ctx, revision_id)
    if not revision or revision.get("projectId") != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")

    artifact_type = str(project.get("artifactType") or "deck")
    title = (body.title or project.get("title") or "Generated Studio Asset").strip()
    fmt = body.format.lower().strip()
    if fmt == "ppt":
        fmt = "pptx"
    if fmt not in {"pdf", "pptx", "csv"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid format. Allowed: pdf, pptx, csv",
        )

    file_bytes = render_html_export(str(revision.get("html") or ""), fmt)
    ext = f".{fmt}"
    file_name = f"{_safe_file_stem(title)}{ext}"
    asset_type = "image" if artifact_type == "image" else "one-pager" if artifact_type == "one_pager" else "deck"

    kb_repo = get_kb_repository()
    result = kb_repo.create_upload(
        ctx,
        file_name=file_name,
        file_bytes=file_bytes,
        ext=ext,
        title=title,
        tags=[*body.tags, "content-studio", artifact_type],
        asset_type=asset_type,
    )
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    background_tasks.add_task(
        process_ingest_job,
        {
            "id": result["job"]["id"],
            "tenant_id": tenant_uuid,
            "asset_id": result["asset"]["id"],
            "_clerk_key": clerk_key,
            "_uploaded_by": ctx.user_id,
        },
        kb_repo,
    )
    result["format"] = fmt
    return result


def _safe_file_stem(value: str) -> str:
    import re

    clean = re.sub(r"[^\w.\- ]+", "", value).strip(" ._-")
    return clean[:96] or "Generated Studio Asset"


@router.post("/studio/projects/{project_id}/submit-review")
def submit_project_review(
    project_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    from app.services.content_gaps_service import submit_project_for_review

    try:
        return submit_project_for_review(ctx, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/studio/projects/{project_id}/approve")
def approve_project(
    project_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    from app.services.content_gaps_service import approve_project_to_kb

    try:
        return approve_project_to_kb(ctx, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/studio/projects/{project_id}/export")
def export_project(
    project_id: str,
    body: ExportBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    project = get_content_studio_repository().get_project(ctx, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    revision = get_content_studio_repository().get_revision(ctx, body.revisionId)
    if not revision or revision.get("projectId") != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")
    try:
        return _orch.dispatch_studio_export(ctx, body.revisionId, body.format)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
