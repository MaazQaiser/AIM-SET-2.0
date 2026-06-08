from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from dc_core.tenancy import TenantContext

from app.domain.clp_repository import get_clp_repository
from app.domain.clp_service import get_clp_service
from app.domain.kb_repository import get_kb_repository
from app.services.office_preview import slide_storage_path

router = APIRouter(prefix="/api/v1/public/clp", tags=["public-clp"])
_svc = get_clp_service()
_repo = get_clp_repository()
_kb_repo = get_kb_repository()


def _public_asset_ids(page: Dict[str, Any]) -> set[str]:
    ids = {
        str(asset.get("assetId"))
        for asset in page.get("selectedAssets") or []
        if asset.get("assetId")
    }
    for section in page.get("sections") or []:
        if section.get("assetId"):
            ids.add(str(section["assetId"]))
        for asset_id in section.get("assetIds") or []:
            if asset_id:
                ids.add(str(asset_id))
    return ids


def _public_asset_context(share_token: str, asset_id: str) -> tuple[Dict[str, Any], Dict[str, Any], TenantContext]:
    page = _repo.get_by_token(share_token)
    if not page or page.get("status") != "published":
        raise HTTPException(status_code=404, detail="Landing page not available")
    if asset_id not in _public_asset_ids(page):
        raise HTTPException(status_code=404, detail="Asset not shared on this landing page")

    tenant_id = str(page.get("tenantId") or "")
    owner_user_id = str(page.get("ownerUserId") or "public")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Asset tenant not found")

    row = _kb_repo.get_asset_row(tenant_id, asset_id, owner_user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")

    return page, row, TenantContext(user_id=owner_user_id, tenant_id=tenant_id)


@router.post("/{share_token}/auth")
def public_auth(share_token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    password = str(body.get("password") or "").strip()
    try:
        return _svc.public_auth(share_token, password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/{share_token}/identify")
def public_identify(share_token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    name = str(body.get("name") or "").strip()
    email = str(body.get("email") or "").strip()
    if not name or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Name and valid email required")
    try:
        return _svc.public_identify(share_token, name=name, email=email, title=body.get("title"))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{share_token}")
def public_get(share_token: str) -> Dict[str, Any]:
    try:
        page = _svc._repo.get_by_token(share_token)
        if page:
            _repo.add_event(page["id"], "link_opened")
        return _svc.public_payload(share_token)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{share_token}/assets/{asset_id}/preview/slides")
def public_asset_preview_slides(share_token: str, asset_id: str) -> Dict[str, Any]:
    _, row, _ = _public_asset_context(share_token, asset_id)
    slide_count = int(row.get("preview_slide_count") or 0)
    if slide_count <= 0:
        raise HTTPException(status_code=404, detail="Slide preview not found for asset")
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


@router.get("/{share_token}/assets/{asset_id}/preview/slides/{slide_index}")
def public_asset_preview_slide(share_token: str, asset_id: str, slide_index: int) -> Response:
    if slide_index < 1:
        raise HTTPException(status_code=400, detail="slide_index must be >= 1")
    page, row, ctx = _public_asset_context(share_token, asset_id)
    slide_count = int(row.get("preview_slide_count") or 0)
    if slide_count <= 0 or slide_index > slide_count:
        raise HTTPException(status_code=404, detail="Slide not found")
    path = slide_storage_path(str(page["tenantId"]), asset_id, slide_index)
    try:
        data = _kb_repo.download_file(ctx, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Slide file not found") from exc
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.get("/{share_token}/assets/{asset_id}/preview")
def public_asset_preview(share_token: str, asset_id: str) -> Response:
    _, row, ctx = _public_asset_context(share_token, asset_id)
    preview_path = row.get("preview_storage_path")
    if not preview_path:
        raise HTTPException(status_code=404, detail="Preview not found for asset")
    try:
        data = _kb_repo.download_file(ctx, str(preview_path))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Preview file not found") from exc

    file_name = row.get("file_name") or "asset"
    stem = Path(file_name).stem
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{stem}-preview.pdf"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get("/{share_token}/assets/{asset_id}/file")
def public_asset_file(share_token: str, asset_id: str) -> Response:
    _, row, ctx = _public_asset_context(share_token, asset_id)
    storage_path = row.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="File not found for asset")
    try:
        data = _kb_repo.download_file(ctx, str(storage_path))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc

    mime = row.get("mime_type") or "application/octet-stream"
    file_name = row.get("file_name") or "asset"
    return Response(
        content=data,
        media_type=mime,
        headers={
            "Content-Disposition": f'inline; filename="{file_name}"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.post("/{share_token}/events")
def public_events(share_token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    events = body.get("events") or []
    if not isinstance(events, list):
        raise HTTPException(status_code=400, detail="events must be a list")
    try:
        return _svc.ingest_public_events(
            share_token,
            events,
            visitor_id=body.get("visitorId"),
            session_id=body.get("sessionId"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{share_token}/proposal")
def public_proposal(share_token: str) -> Dict[str, Any]:
    payload = _svc.public_payload(share_token)
    proposal = payload.get("proposal")
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not published")
    page = payload.get("page") or {}
    if page.get("id"):
        _repo.add_event(page["id"], "proposal_opened", payload={})
    return proposal


@router.post("/{share_token}/chat")
def public_chat(share_token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    page = _repo.get_by_token(share_token)
    if not page or page.get("status") != "published":
        raise HTTPException(status_code=404, detail="Not found")
    visitor_id = str(body.get("visitorId") or "").strip()
    text = str(body.get("body") or "").strip()
    if not visitor_id or not text:
        raise HTTPException(status_code=400, detail="visitorId and body required")
    msg = _repo.add_chat_message(
        page["id"],
        visitor_id=visitor_id,
        author_type="visitor",
        author_name=str(body.get("authorName") or "Visitor"),
        body=text,
        session_id=body.get("sessionId"),
    )
    _svc.ingest_public_events(
        share_token,
        [{"eventType": "chat_message_sent", "payload": {"body": text[:200]}}],
        visitor_id=visitor_id,
        session_id=body.get("sessionId"),
    )
    return msg


@router.get("/{share_token}/chat")
def public_chat_list(share_token: str, visitorId: str = "") -> List[Dict[str, Any]]:
    page = _repo.get_by_token(share_token)
    if not page:
        raise HTTPException(status_code=404, detail="Not found")
    return _repo.list_chat(page["id"], visitor_id=visitorId or None)


@router.post("/{share_token}/comments")
def public_comment(share_token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    page = _repo.get_by_token(share_token)
    if not page:
        raise HTTPException(status_code=404, detail="Not found")
    text = str(body.get("body") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="body required")
    comment = _repo.add_comment(
        page["id"],
        section_id=body.get("sectionId"),
        author_type="visitor",
        author_name=str(body.get("authorName") or "Visitor"),
        body=text,
        visitor_id=body.get("visitorId"),
    )
    _repo.add_event(page["id"], "comment_created", visitor_id=body.get("visitorId"), payload={"sectionId": body.get("sectionId")})
    return comment


@router.get("/{share_token}/comments")
def public_comments(share_token: str) -> List[Dict[str, Any]]:
    page = _repo.get_by_token(share_token)
    if not page:
        raise HTTPException(status_code=404, detail="Not found")
    return _repo.list_comments(page["id"])
