from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from app.domain.clp_repository import get_clp_repository
from app.domain.clp_service import get_clp_service

router = APIRouter(prefix="/api/v1/public/clp", tags=["public-clp"])
_svc = get_clp_service()
_repo = get_clp_repository()


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
