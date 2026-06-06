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


def _source_path(source: str, call_id: str) -> str:
    if not call_id:
        return "/content?tab=suggestions"
    return f"/calls/{call_id}/post-dc" if source == "post_dc" else f"/calls/{call_id}"


def _flatten_dict_lists(items: List[Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in items:
        if isinstance(item, list):
            out.extend([child for child in item if isinstance(child, dict)])
        elif isinstance(item, dict):
            out.append(item)
    return out


def _gap_context(
    *,
    source: str,
    call_id: str,
    name: str,
    artifact_type: str,
    reason: str,
    needed_for: str,
    account_name: str = "",
    lead_name: str = "",
    industry: str = "",
    source_artifact_id: str = "",
    required_data: str = "",
    item: Optional[Dict[str, Any]] = None,
    brief: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    item = item or {}
    brief = brief or {}
    relevant_projects = item.get("relevantProjects") or brief.get("relevantProjects") or []
    relevant_documents = item.get("relevantDocuments") or brief.get("relevantDocuments") or []
    recommended_deck = item.get("recommendedDeck") or brief.get("recommendedDeck")
    context: Dict[str, Any] = {
        "source": source,
        "sourcePath": _source_path(source, call_id),
        "callId": call_id,
        "accountName": account_name or brief.get("accountName") or "",
        "leadName": lead_name or brief.get("leadName") or "",
        "industry": industry or brief.get("industry") or "",
        "assetName": name,
        "artifactType": artifact_type,
        "sourceArtifactId": source_artifact_id,
        "reason": reason,
        "neededFor": needed_for,
        "requiredData": required_data or reason,
        "whatToCreate": required_data or reason or needed_for,
        "evidence": item.get("evidence") or [],
        "slidePlan": item.get("slidePlan") or [],
        "relevantProjects": relevant_projects,
        "relevantDocuments": relevant_documents,
    }
    if recommended_deck:
        context["recommendedDeck"] = recommended_deck
    return context


def sync_gaps_from_brief(ctx: TenantContext, call_id: str, brief: Dict[str, Any]) -> None:
    repo = get_content_gaps_repository()
    for item in brief.get("contentToGenerate") or []:
        status = str(item.get("status") or "").lower()
        if status not in ("missing", "partial"):
            continue
        artifact_id = str(item.get("sourceArtifactId") or item.get("id") or "")
        name = str(item.get("name") or "New content")
        artifact_type = _map_artifact_type(str(item.get("type") or "deck"))
        reason = str(item.get("reason") or "")
        needed_for = str(item.get("neededFor") or "")
        gap_key = f"pre_dc:{call_id}:{artifact_id or item.get('name', '')}"
        repo.upsert_gap(
            ctx,
            gap_key=gap_key,
            source="pre_dc",
            name=name,
            artifact_type=artifact_type,
            call_id=call_id,
            reason=reason,
            needed_for=needed_for,
            source_path=_source_path("pre_dc", call_id),
            context=_gap_context(
                source="pre_dc",
                call_id=call_id,
                name=name,
                artifact_type=artifact_type,
                reason=reason,
                needed_for=needed_for,
                account_name=str(brief.get("accountName") or ""),
                source_artifact_id=artifact_id,
                required_data=reason,
                item=item,
                brief=brief,
            ),
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
        artifact_type = _map_artifact_type(str(item.get("type") or name))
        reason = str(item.get("requiredData") or item.get("reason") or "")
        gap_key = f"post_dc:{call_id}:{name.lower()}"
        repo.upsert_gap(
            ctx,
            gap_key=gap_key,
            source="post_dc",
            name=name,
            artifact_type=artifact_type,
            call_id=call_id,
            reason=reason,
            needed_for="Post-call follow-up and email attachments",
            source_path=_source_path("post_dc", call_id),
            context=_gap_context(
                source="post_dc",
                call_id=call_id,
                name=name,
                artifact_type=artifact_type,
                reason=reason,
                needed_for="Post-call follow-up and email attachments",
                account_name=str(post_result.get("accountName") or ""),
                required_data=reason,
                item=item,
                brief=post_result,
            ),
            priority=2,
        )


def upsert_gap_from_studio_brief(
    ctx: TenantContext,
    *,
    gap_key: str,
    project_id: Optional[str],
    title: str,
    artifact_type: str,
    brief: Dict[str, Any],
    call_id: Optional[str] = None,
) -> Dict[str, Any]:
    source_raw = str(brief.get("source") or "pre-dc")
    source = "post_dc" if source_raw.replace("_", "-") == "post-dc" else "pre_dc"
    resolved_call_id = str(call_id or brief.get("call_id") or brief.get("callId") or "").strip()
    reason = str(brief.get("generation_reason") or brief.get("reason") or "").strip()
    needed_for = str(brief.get("needed_for") or brief.get("neededFor") or "").strip()
    context = _gap_context(
        source=source,
        call_id=resolved_call_id,
        name=title,
        artifact_type=artifact_type,
        reason=reason,
        needed_for=needed_for,
        account_name=str(brief.get("account_name") or brief.get("accountName") or ""),
        lead_name=str(brief.get("lead_name") or brief.get("leadName") or ""),
        industry=str(brief.get("industry") or ""),
        source_artifact_id=str(brief.get("source_artifact_id") or brief.get("sourceArtifactId") or ""),
        required_data=str(
            brief.get("content_requirements")
            or brief.get("what_to_create")
            or brief.get("whatToCreate")
            or reason
        ),
        item={
            "evidence": brief.get("explicit_evidence") or [],
            "slidePlan": (brief.get("suggestion_plan") or {}).get("slide_plan")
            if isinstance(brief.get("suggestion_plan"), dict)
            else [],
            "relevantProjects": _flatten_dict_lists(
                [
                    lead.get("relevantProjects") or lead.get("relevant_projects") or []
                    for lead in brief.get("leads") or []
                    if isinstance(lead, dict)
                ]
            ),
            "relevantDocuments": _flatten_dict_lists(
                [
                    lead.get("relevantDocuments") or lead.get("relevant_documents") or []
                    for lead in brief.get("leads") or []
                    if isinstance(lead, dict)
                ]
            ),
        },
        brief=brief,
    )
    gap = get_content_gaps_repository().upsert_gap(
        ctx,
        gap_key=gap_key,
        source=source,
        name=title,
        artifact_type=artifact_type,
        call_id=resolved_call_id or None,
        reason=reason,
        needed_for=needed_for,
        source_path=context["sourcePath"],
        context={**context, "studioProjectId": project_id or ""},
        priority=int(brief.get("priority") or 2),
    )
    if project_id:
        patched = get_content_gaps_repository().patch_gap(
            ctx,
            str(gap["id"]),
            {"status": "in_progress", "studioProjectId": project_id, "context": {"studioProjectId": project_id}},
        )
        return patched or gap
    return gap


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
