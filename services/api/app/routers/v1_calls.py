from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.calls_service import CallsService
from app.orchestrator.dispatcher import Orchestrator
from app.services.transcript_provider.recall_client import (
    RecallAPIError,
    RecallConfigurationError,
    create_recall_live_bot,
)

router = APIRouter(prefix="/api/v1/calls", tags=["calls"])
_calls = CallsService()
_orch = Orchestrator()


@router.get("")
def list_calls(ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    return _calls.list_calls(ctx)


@router.get("/{call_id}")
def get_call(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    call = _calls.get_call(ctx, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.get("/{call_id}/brief")
def get_brief(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    brief = _calls.get_brief(ctx, call_id)
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


@router.post("/{call_id}/generate-brief")
def generate_brief(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_pre_dc_brief(ctx, call_id)


@router.post("/{call_id}/post-call")
def post_call_pipeline(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_post_call(ctx, call_id)


@router.post("/{call_id}/end-live")
def end_live_call(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_call_end(ctx, call_id)


@router.post("/{call_id}/recall-bot")
def start_recall_bot(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    meeting_url = str(body.get("meeting_url") or body.get("meetingUrl") or "").strip()
    if not _calls.get_call(ctx, call_id):
        # Live cockpit may use client-seeded demo calls (e.g. frontera-franchise-group) not yet in Supabase.
        from app.domain.live_call_repository import get_live_call_repository

        get_live_call_repository().get_or_create_session(ctx, call_id)
    if not meeting_url:
        raise HTTPException(status_code=400, detail="meeting_url is required")
    if not meeting_url.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="meeting_url must be an http(s) URL")

    try:
        return create_recall_live_bot(ctx, call_id, meeting_url)
    except RecallConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RecallAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/{call_id}/bot-chat")
def bot_chat(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    mode = (body.get("mode") or "group").strip().lower()
    if mode not in ("direct", "group"):
        mode = "group"
    return _orch.dispatch_bot_chat(
        ctx,
        call_id,
        message,
        mode=mode,
        sender_name=(body.get("sender_name") or "").strip() or None,
        sender_role=(body.get("sender_role") or "").strip() or None,
    )


@router.get("/{call_id}/transcript-events")
def list_transcript_events(
    call_id: str, ctx: TenantContext = Depends(get_tenant_context)
) -> List[Dict[str, Any]]:
    from app.domain.live_call_repository import get_live_call_repository

    return get_live_call_repository().list_transcript_events(ctx, call_id)


@router.post("/{call_id}/poll-transcript")
def poll_transcript(
    call_id: str, ctx: TenantContext = Depends(get_tenant_context)
) -> Dict[str, Any]:
    """Poll Recall API for transcript when webhooks fail (tunnel down)."""
    from app.domain.live_call_repository import get_live_call_repository
    from app.services.transcript_provider.recall_client import poll_recall_transcript

    repo = get_live_call_repository()
    session = repo.get_session(ctx, call_id)
    if not session or not session.get("provider_meeting_id"):
        raise HTTPException(status_code=404, detail="No active Recall bot for this call")

    bot_id = session["provider_meeting_id"]
    raw_segments = poll_recall_transcript(bot_id)
    if not raw_segments:
        return {"ok": True, "new_segments": 0}

    new_count = 0
    for seg in raw_segments:
        words = seg.get("words") or []
        text = " ".join(w.get("text", "") if isinstance(w, dict) else str(w) for w in words).strip()
        if not text:
            text = seg.get("text", "")
        if not text:
            continue

        speaker = seg.get("speaker") or "unknown"
        speaker_name = speaker
        if isinstance(seg.get("participant"), dict):
            speaker_name = seg["participant"].get("name") or speaker

        # Use speaker + text hash as dedup key
        import hashlib
        peid = hashlib.sha256(f"{bot_id}:{speaker}:{text[:50]}".encode()).hexdigest()[:32]

        offset = 0.0
        if words and isinstance(words[0], dict):
            st = words[0].get("start_timestamp")
            if isinstance(st, dict):
                offset = float(st.get("relative", 0))
            elif st is not None:
                try:
                    offset = float(st)
                except (TypeError, ValueError):
                    pass

        event = {
            "id": peid,
            "speaker_id": speaker_name,
            "speaker_role": "customer",
            "text": text,
            "offset_seconds": offset,
            "provider": "recall",
            "provider_event_id": peid,
        }
        stored = repo.append_transcript_event(ctx, call_id, event)
        # Check if it was actually new (not deduped)
        if stored.get("id") == peid:
            new_count += 1
            # Dispatch through orchestrator for BANT/intent analysis
            try:
                _orch.dispatch_live_segment(ctx, call_id, event, elapsed_seconds=int(event.get("offset_seconds", 0)))
            except Exception:
                pass

    return {"ok": True, "new_segments": new_count, "total_from_recall": len(raw_segments)}


@router.get("/{call_id}/suggestions")
def list_suggestions(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> List[Dict[str, Any]]:
    from app.domain.live_call_repository import get_live_call_repository

    return get_live_call_repository().list_suggestions(ctx, call_id)


@router.post("/{call_id}/suggestions/{suggestion_id}/feedback")
def suggestion_feedback(
    call_id: str,
    suggestion_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    from app.domain.live_call_repository import get_live_call_repository

    status = (body.get("status") or "").strip()
    if status not in ("accepted", "dismissed"):
        raise HTTPException(status_code=400, detail="status must be accepted or dismissed")
    updated = get_live_call_repository().update_suggestion_status(ctx, call_id, suggestion_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return updated
