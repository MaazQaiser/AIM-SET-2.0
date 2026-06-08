from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_tenant_context
from app.domain.content_studio_repository import (
    ARTIFACT_TYPES,
    PARENT_TEMPLATE_TAG,
    TEMPLATE_EXTENSIONS,
    get_content_studio_repository,
)
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
from app.services.template_ingest_service import ensure_template_metadata, ensure_template_preview_slides

TEMPLATE_UPLOAD_EXTENSIONS = {".ppt", ".pptx"}
TEMPLATE_UPLOAD_TOKEN_SCOPE = "content-template-upload"

router = APIRouter(prefix="/api/v1/content", tags=["content-studio"])
_orch = Orchestrator()


def _base64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(f"{segment}{padding}".encode("ascii"))


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _tenant_context_from_upload_token(token: str) -> TenantContext:
    settings = get_settings()
    if not settings.internal_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_SECRET is not configured on the API service",
        )

    raw = token.removeprefix("Bearer ").strip()
    try:
        payload_segment, signature = raw.split(".", 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid upload token",
        ) from exc

    expected = _base64url_encode(
        hmac.new(
            settings.internal_secret.encode("utf-8"),
            payload_segment.encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid upload token",
        )

    try:
        payload = json.loads(_base64url_decode(payload_segment).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid upload token",
        ) from exc

    if payload.get("scope") != TEMPLATE_UPLOAD_TOKEN_SCOPE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid upload token scope",
        )
    if int(payload.get("exp") or 0) < int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Upload token expired",
        )

    user_id = str(payload.get("userId") or "").strip()
    tenant_id = str(payload.get("tenantId") or user_id).strip()
    clerk_org_id = str(payload.get("clerkOrgId") or "").strip() or None
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid upload token",
        )
    return TenantContext.from_headers(user_id, tenant_id, clerk_org_id)


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


class StudioChatBody(BaseModel):
    message: str = ""
    templateId: Optional[str] = None
    generate: bool = False


class ContentPlanLead(BaseModel):
    callId: Optional[str] = None
    call_id: Optional[str] = None
    accountName: Optional[str] = None
    account_name: Optional[str] = None
    leadName: Optional[str] = None
    lead_name: Optional[str] = None
    industry: Optional[str] = None
    relevantProjects: List[Dict[str, Any]] = Field(default_factory=list)
    relevant_projects: List[Dict[str, Any]] = Field(default_factory=list)
    relevantDocuments: List[Dict[str, Any]] = Field(default_factory=list)
    relevant_documents: List[Dict[str, Any]] = Field(default_factory=list)
    recommendedDeck: Optional[Dict[str, Any]] = None
    recommended_deck: Optional[Dict[str, Any]] = None


class ContentPlanBody(BaseModel):
    suggestionId: str
    title: str
    artifactType: str = "deck"
    source: str = "pre-dc"
    generationReason: str = ""
    neededFor: str = ""
    sourcePath: str = ""
    contentRequirements: str = ""
    context: Dict[str, Any] = Field(default_factory=dict)
    industry: str = ""
    leads: List[ContentPlanLead] = Field(default_factory=list)
    kbAssetIds: List[str] = Field(default_factory=list)


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
    metadata: Optional[Dict[str, Any]] = None


class TemplatePatchBody(BaseModel):
    name: Optional[str] = None
    artifactType: Optional[str] = None
    html: Optional[str] = None
    css: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


def _upload_token_context(
    authorization: Optional[str] = None,
    x_upload_token: Optional[str] = None,
) -> TenantContext:
    token = authorization or x_upload_token or ""
    return _tenant_context_from_upload_token(token)


def _save_parent_template(ctx: TenantContext, body: TemplateBody) -> Dict[str, Any]:
    name = (body.name or PARENT_TEMPLATE_TAG).strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template name is required")
    if body.artifactType not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")

    try:
        validate_template_html(body.html, body.css)
        document = build_template_document(body.html, body.css)
        _, resolved_css = split_template_parts(document)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tags = list({PARENT_TEMPLATE_TAG, *(t.strip() for t in (body.tags or []) if str(t).strip())})
    metadata = {**(body.metadata or {}), "isParentTemplate": True}
    css_variables = extract_css_variables(resolved_css)
    page_count = count_template_pages(document, body.artifactType)

    repo = get_content_studio_repository()
    existing = repo.get_parent_template(ctx)
    if existing and existing.get("id"):
        tpl = repo.update_template(
            ctx,
            str(existing["id"]),
            {
                "name": name,
                "artifactType": body.artifactType,
                "html": document,
                "cssVariables": css_variables,
                "tags": tags,
                "metadata": metadata,
                "pageCount": page_count,
            },
        )
        if tpl:
            return tpl

    return repo.create_manual_template(
        ctx,
        name=name,
        artifact_type=body.artifactType,
        html=document,
        css_variables=css_variables,
        tags=tags,
        page_count=page_count,
        metadata=metadata,
    )


async def _upload_parent_template_asset_bytes(
    *,
    file_bytes: bytes,
    file_name: str,
    ctx: TenantContext,
) -> Dict[str, str]:
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file")
    try:
        return get_content_studio_repository().upload_parent_asset(
            ctx,
            file_bytes=file_bytes,
            file_name=file_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc


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


def _create_template_from_body(ctx: TenantContext, body: TemplateBody) -> Dict[str, Any]:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template name is required")
    if body.artifactType not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")

    try:
        validate_template_html(body.html, body.css)
        document = build_template_document(body.html, body.css)
        _, resolved_css = split_template_parts(document)
        return get_content_studio_repository().create_manual_template(
            ctx,
            name=name,
            artifact_type=body.artifactType,
            html=document,
            css_variables=extract_css_variables(resolved_css),
            tags=body.tags,
            page_count=count_template_pages(document, body.artifactType),
            metadata=body.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/templates")
def create_template(
    body: TemplateBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    return _create_template_from_body(ctx, body)


@router.post("/templates/direct")
def create_template_direct(
    body: TemplateBody,
    authorization: Optional[str] = Header(default=None),
    x_upload_token: Optional[str] = Header(default=None, alias="x-upload-token"),
) -> Dict[str, Any]:
    ctx = _upload_token_context(authorization, x_upload_token)
    return _create_template_from_body(ctx, body)


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


@router.get("/templates/parent")
def get_parent_template(
    ctx: TenantContext = Depends(get_tenant_context),
) -> Optional[Dict[str, Any]]:
    """Return the singleton parent template, or null when not yet configured."""
    return get_content_studio_repository().get_parent_template(ctx)


@router.post("/templates/parent/assets")
async def upload_parent_template_asset(
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, str]:
    data = await file.read()
    return await _upload_parent_template_asset_bytes(
        file_bytes=data,
        file_name=file.filename or "asset.png",
        ctx=ctx,
    )


@router.post("/templates/parent/assets/direct")
async def upload_parent_template_asset_direct(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
    x_upload_token: Optional[str] = Header(default=None, alias="x-upload-token"),
) -> Dict[str, str]:
    ctx = _upload_token_context(authorization, x_upload_token)
    data = await file.read()
    return await _upload_parent_template_asset_bytes(
        file_bytes=data,
        file_name=file.filename or "asset.png",
        ctx=ctx,
    )


@router.put("/templates/parent/direct")
def save_parent_template_direct(
    body: TemplateBody,
    authorization: Optional[str] = Header(default=None),
    x_upload_token: Optional[str] = Header(default=None, alias="x-upload-token"),
) -> Dict[str, Any]:
    ctx = _upload_token_context(authorization, x_upload_token)
    return _save_parent_template(ctx, body)


@router.get("/templates/parent/assets/{asset_name}")
def get_parent_template_asset(
    asset_name: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Response:
    try:
        data, mime_type = get_content_studio_repository().download_parent_asset(ctx, asset_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found") from exc
    return Response(
        content=data,
        media_type=mime_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/templates/{template_id}")
def get_template(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    repo = get_content_studio_repository()
    tpl = repo.get_template(ctx, template_id)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    metadata = tpl.get("metadata") if isinstance(tpl.get("metadata"), dict) else {}
    if tpl.get("hasSourceFile") and tpl.get("status") == "ready" and not (metadata.get("slides") if metadata else None):
        try:
            ensure_template_metadata(ctx, template_id)
            tpl = repo.get_template(ctx, template_id) or tpl
        except Exception:
            pass
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


def _update_template_from_body(
    ctx: TenantContext,
    template_id: str,
    body: TemplatePatchBody,
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
    if body.metadata is not None:
        patch["metadata"] = body.metadata
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


@router.patch("/templates/{template_id}")
def update_template(
    template_id: str,
    body: TemplatePatchBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    return _update_template_from_body(ctx, template_id, body)


@router.patch("/templates/{template_id}/direct")
def update_template_direct(
    template_id: str,
    body: TemplatePatchBody,
    authorization: Optional[str] = Header(default=None),
    x_upload_token: Optional[str] = Header(default=None, alias="x-upload-token"),
) -> Dict[str, Any]:
    ctx = _upload_token_context(authorization, x_upload_token)
    return _update_template_from_body(ctx, template_id, body)


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, str]:
    ok = get_content_studio_repository().delete_template(ctx, template_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return {"status": "deleted", "templateId": template_id}


async def _upload_template_file(
    background_tasks: BackgroundTasks,
    *,
    file: UploadFile,
    name: Optional[str],
    artifact_type: Optional[str],
    tags: Optional[str],
    ctx: TenantContext,
) -> Dict[str, Any]:
    file_name = file.filename or "upload.bin"
    ext = Path(file_name).suffix.lower()
    if ext not in TEMPLATE_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(TEMPLATE_UPLOAD_EXTENSIONS))}",
        )
    content = await file.read()
    if len(content) > get_settings().kb_max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    result = _orch.dispatch_template_ingest(
        ctx,
        file_name=file_name,
        file_bytes=content,
        ext=ext,
        name=name,
        artifact_type=artifact_type,
        tags=tag_list,
        process=False,
    )
    background_tasks.add_task(
        _orch.complete_template_ingest,
        ctx,
        result["template"]["id"],
        result["storagePath"],
    )
    return result


@router.post("/templates/upload")
async def upload_template(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    artifact_type: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    return await _upload_template_file(
        background_tasks,
        file=file,
        name=name,
        artifact_type=artifact_type,
        tags=tags,
        ctx=ctx,
    )


@router.post("/templates/upload/direct")
async def upload_template_direct(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    artifact_type: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    authorization: Optional[str] = Header(default=None),
    x_upload_token: Optional[str] = Header(default=None, alias="x-upload-token"),
) -> Dict[str, Any]:
    token = authorization or x_upload_token or ""
    ctx = _tenant_context_from_upload_token(token)
    return await _upload_template_file(
        background_tasks,
        file=file,
        name=name,
        artifact_type=artifact_type,
        tags=tags,
        ctx=ctx,
    )


@router.get("/studio/projects")
def list_projects(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return get_content_studio_repository().list_projects(ctx)


@router.post("/plan")
def build_content_plan(
    body: ContentPlanBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    from app.agents.content_plan_agent import run_content_plan

    artifact = body.artifactType.lower().replace("-", "_")
    if artifact == "case_study":
        artifact = "deck"
    if artifact not in ARTIFACT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifactType")

    leads_payload = [lead.model_dump(exclude_none=True) for lead in body.leads]
    try:
        envelope = run_content_plan(
            ctx,
            suggestion_id=body.suggestionId,
            title=body.title,
            artifact_type=artifact,
            source=body.source,
            generation_reason=body.generationReason,
            needed_for=body.neededFor,
            source_path=body.sourcePath,
            content_requirements=body.contentRequirements,
            extra_context=body.context,
            industry=body.industry,
            leads=leads_payload,
            kb_asset_ids=body.kbAssetIds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return envelope.model_dump()


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
    _link_gap_to_project(ctx, body.gapId, str(project["id"]), body)
    return project


def _link_gap_to_project(
    ctx: TenantContext,
    gap_ref: Optional[str],
    project_id: str,
    body: CreateProjectBody,
) -> None:
    if not gap_ref:
        return
    from app.services.content_gaps_service import upsert_gap_from_studio_brief

    upsert_gap_from_studio_brief(
        ctx,
        gap_key=gap_ref,
        project_id=project_id,
        title=body.title,
        artifact_type=body.artifactType,
        brief=body.brief,
        call_id=body.callId,
    )


@router.get("/studio/projects/{project_id}")
def get_project(
    project_id: str,
    include_latest: bool = Query(True, alias="includeLatest"),
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    repo = get_content_studio_repository()
    project = repo.get_project(ctx, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=3) as pool:
        f_messages = pool.submit(repo.list_messages, ctx, project_id)
        f_revisions = pool.submit(repo.list_revisions, ctx, project_id)
        f_latest = pool.submit(repo.latest_revision, ctx, project_id) if include_latest else None
        messages = f_messages.result()
        revisions = f_revisions.result()
        latest = f_latest.result() if f_latest is not None else None

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


@router.post("/studio/projects/{project_id}/chat")
def chat_stream(
    project_id: str,
    body: StudioChatBody,
    ctx: TenantContext = Depends(get_tenant_context),
) -> StreamingResponse:
    """Real-time streaming chat endpoint — returns Server-Sent Events."""
    from app.agents.content_generation_agent import stream_studio_chat

    def _generate():
        try:
            yield from stream_studio_chat(
                ctx,
                project_id=project_id,
                user_message=body.message,
                template_id=body.templateId,
                generate=body.generate,
            )
        except Exception as exc:
            import json as _json
            yield f"data: {_json.dumps({'type': 'error', 'text': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


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

    revision_html = str(revision.get("html") or "")
    file_bytes = render_html_export(revision_html, fmt)
    ext = f".{fmt}"
    file_name = f"{_safe_file_stem(title)}{ext}"
    asset_type = "image" if artifact_type == "image" else "one-pager" if artifact_type == "one_pager" else "deck"

    # Extract plain text from the HTML so the ingest pipeline can index it even
    # when the exported file format (e.g. image-based PPTX) has no extractable text.
    from app.services.content_export_service import _html_fragment_to_text, _split_sections

    slide_texts = [_html_fragment_to_text(s) for s in _split_sections(revision_html)]
    source_text = "\n\n".join(t for t in slide_texts if t).strip()

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
            "_source_text": source_text,
        },
        kb_repo,
    )
    from app.services.deck_assembly_service import store_revision_slide_sections

    store_revision_slide_sections(ctx, str(result["asset"]["id"]), str(revision.get("html") or ""))

    gap_id = (project.get("brief") or {}).get("gap_id")
    if gap_id:
        from app.domain.content_gaps_repository import get_content_gaps_repository

        gap_repo = get_content_gaps_repository()
        brief = project.get("brief") or {}
        gap = gap_repo.get_gap(ctx, str(gap_id))
        if not gap:
            # Gap was never persisted (e.g. user clicked "Generate in Studio" without
            # dismissing first). Create it now so we can mark it resolved.
            gap = gap_repo.upsert_gap(
                ctx,
                gap_key=str(gap_id),
                source=str(brief.get("source") or "pre_dc"),
                name=title,
                artifact_type=artifact_type,
                call_id=str(brief.get("call_id") or brief.get("callId") or "") or None,
                reason=str(brief.get("reason") or "") or None,
                needed_for=str(brief.get("neededFor") or brief.get("needed_for") or "") or None,
                source_path=str(brief.get("sourcePath") or brief.get("source_path") or "") or None,
            )
        if gap:
            gap_repo.patch_gap(
                ctx,
                str(gap["id"]),
                {
                    "status": "resolved",
                    "kbAssetId": str(result["asset"]["id"]),
                    "studioProjectId": project_id,
                },
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
