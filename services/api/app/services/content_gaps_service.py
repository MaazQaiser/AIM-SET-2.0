from __future__ import annotations

from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.domain.content_gaps_repository import get_content_gaps_repository
from app.domain.content_studio_repository import get_content_studio_repository
from app.domain.kb_repository import get_kb_repository
from app.services.content_export_service import export_revision_file_bytes


def _map_artifact_type(raw: str) -> str:
    normalized = str(raw or "deck").lower().replace("-", "_")
    if "one" in normalized:
        return "one_pager"
    if "image" in normalized:
        return "image"
    return "deck"


def sync_gaps_from_brief(ctx: TenantContext, call_id: str, brief: Dict[str, Any]) -> None:
    repo = get_content_gaps_repository()
    for item in brief.get("contentToGenerate") or []:
        status = str(item.get("status") or "").lower()
        if status not in ("missing", "partial"):
            continue
        artifact_id = str(item.get("sourceArtifactId") or item.get("id") or "")
        gap_key = f"pre_dc:{call_id}:{artifact_id or item.get('name', '')}"
        repo.upsert_gap(
            ctx,
            gap_key=gap_key,
            source="pre_dc",
            name=str(item.get("name") or "New content"),
            artifact_type=_map_artifact_type(str(item.get("type") or "deck")),
            call_id=call_id,
            reason=str(item.get("reason") or ""),
            needed_for=str(item.get("neededFor") or ""),
            priority=int(item.get("priority") or 2),
        )


def sync_gaps_from_post_call(ctx: TenantContext, call_id: str, post_result: Dict[str, Any]) -> None:
    repo = get_content_gaps_repository()
    attachments = post_result.get("emailAttachments") or {}
    if not isinstance(attachments, dict):
        attachments = {}
    missing: List[Dict[str, Any]] = attachments.get("missing") or []
    for item in missing:
        name = str(item.get("name") or "Attachment").strip()
        gap_key = f"post_dc:{call_id}:{name.lower()}"
        repo.upsert_gap(
            ctx,
            gap_key=gap_key,
            source="post_dc",
            name=name,
            artifact_type=_map_artifact_type(str(item.get("type") or name)),
            call_id=call_id,
            reason=str(item.get("requiredData") or item.get("reason") or ""),
            needed_for="Post-call follow-up and email attachments",
            priority=2,
        )


def submit_project_for_review(ctx: TenantContext, project_id: str) -> Dict[str, Any]:
    repo = get_content_studio_repository()
    project = repo.get_project(ctx, project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")
    latest = repo.latest_revision(ctx, project_id)
    if not latest:
        raise ValueError("Generate a preview before submitting for review")
    updated = repo.update_project(ctx, project_id, {"status": "pending_review"})
    return updated or project


def approve_project_to_kb(ctx: TenantContext, project_id: str) -> Dict[str, Any]:
    studio = get_content_studio_repository()
    gaps = get_content_gaps_repository()
    kb = get_kb_repository()

    project = studio.get_project(ctx, project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")
    latest = studio.latest_revision(ctx, project_id)
    if not latest:
        raise ValueError("No revision to publish")

    file_bytes = export_revision_file_bytes(ctx, latest["id"], "pdf")
    if not file_bytes:
        raise ValueError("Failed to export revision for KB ingest")

    title = str(project.get("title") or "Generated content")
    artifact_type = str(project.get("artifactType") or "deck")
    kb_type = "one-pager" if artifact_type == "one_pager" else "deck" if artifact_type == "deck" else "image"
    upload = kb.create_upload(
        ctx,
        file_name=f"{title}.pdf",
        file_bytes=file_bytes,
        ext=".pdf",
        title=title,
        tags=["studio-generated"],
        asset_type=kb_type,
    )
    asset = upload.get("asset") or {}
    asset_id = asset.get("id")

    brief = project.get("brief") or {}
    gap_id = brief.get("gap_id")
    if gap_id:
        gaps.patch_gap(
            ctx,
            str(gap_id),
            {"status": "resolved", "kbAssetId": asset_id, "studioProjectId": project_id},
        )

    studio.update_project(ctx, project_id, {"status": "published"})
    return {"projectId": project_id, "asset": asset}
