from __future__ import annotations

from typing import Any, Dict, List, Set

from fastapi import APIRouter, Depends, HTTPException

from dc_core.tenancy import TenantContext

from app.deps import get_tenant_context
from app.domain.calls_service import CallsService
from app.domain.copilot_greeting import simple_greeting_response
from app.orchestrator.dispatcher import Orchestrator
from app.services.transcript_provider.recall_client import (
    RecallAPIError,
    RecallConfigurationError,
    create_recall_live_bot,
)

router = APIRouter(prefix="/api/v1/calls", tags=["calls"])
_calls = CallsService()
_orch = Orchestrator()
_poll_emitted_event_ids: Dict[str, Set[str]] = {}


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


@router.get("/{call_id}/relevant-content")
def get_relevant_content(
    call_id: str,
    ctx: TenantContext = Depends(get_tenant_context),
    refresh: bool = False,
) -> Dict[str, Any]:
    try:
        return _orch.get_relevant_content(ctx, call_id, refresh=refresh)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{call_id}/generate-brief")
def generate_brief(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_pre_dc_brief(ctx, call_id)


@router.post("/{call_id}/post-call")
def post_call_pipeline(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    return _orch.dispatch_post_call(ctx, call_id)


@router.get("/{call_id}/post-call")
def get_post_call_review(call_id: str, ctx: TenantContext = Depends(get_tenant_context)) -> Dict[str, Any]:
    payload = _calls.get_post_review(ctx, call_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Post-call review not found")
    return payload


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
async def bot_chat(
    call_id: str,
    body: Dict[str, Any],
    ctx: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    import asyncio
    from app.domain.call_channel import get_call_channel

    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    mode = (body.get("mode") or "group").strip().lower()
    if mode not in ("direct", "group"):
        mode = "group"
    greeting = simple_greeting_response(message, "live_dc")
    if greeting:
        return greeting

    result = await asyncio.to_thread(
        _orch.dispatch_bot_chat,
        ctx,
        call_id,
        message,
        mode=mode,
        sender_name=(body.get("sender_name") or "").strip() or None,
        sender_role=(body.get("sender_role") or "").strip() or None,
        context=body.get("context") if isinstance(body.get("context"), dict) else None,
    )
    channel = get_call_channel()
    for msg in result.get("ws_messages") or []:
        await channel.broadcast(call_id, msg)
    return result


@router.get("/{call_id}/transcript-events")
def list_transcript_events(
    call_id: str, ctx: TenantContext = Depends(get_tenant_context)
) -> List[Dict[str, Any]]:
    from app.domain.live_call_repository import get_live_call_repository

    return get_live_call_repository().list_transcript_events(ctx, call_id)


@router.post("/{call_id}/poll-transcript")
async def poll_transcript(
    call_id: str, ctx: TenantContext = Depends(get_tenant_context)
) -> Dict[str, Any]:
    """Poll Recall API for transcript when webhooks fail (tunnel down)."""
    import asyncio
    import hashlib

    from app.domain.call_channel import get_call_channel
    from app.domain.live_call_repository import get_live_call_repository
    from app.orchestrator.live_broadcast import transcript_event_to_ws
    from app.services.transcript_provider.recall_client import poll_recall_transcript

    repo = get_live_call_repository()
    session = repo.get_session(ctx, call_id)
    if not session or not session.get("provider_meeting_id"):
        raise HTTPException(status_code=404, detail="No active Recall bot for this call")

    bot_id = session["provider_meeting_id"]
    raw_segments = await asyncio.to_thread(poll_recall_transcript, bot_id)
    if not raw_segments:
        return {"ok": True, "new_segments": 0}

    channel = get_call_channel()
    new_count = 0
    new_events: List[Dict[str, Any]] = []
    seen_key = f"{ctx.tenant_id}:{call_id}"
    seen_ids = _poll_emitted_event_ids.setdefault(seen_key, set())
    for seg in raw_segments:
        words = seg.get("words") or []
        text = " ".join(w.get("text", "") if isinstance(w, dict) else str(w) for w in words).strip()
        if not text:
            text = seg.get("text", "")
        if not text:
            continue

        participant = seg.get("participant") if isinstance(seg.get("participant"), dict) else {}
        speaker_raw = seg.get("speaker")
        speaker_obj = speaker_raw if isinstance(speaker_raw, dict) else {}
        speaker = (
            speaker_obj.get("id")
            or speaker_obj.get("speaker_id")
            or speaker_obj.get("name")
            or speaker_obj.get("display_name")
            or speaker_obj.get("displayName")
            or speaker_raw
            or seg.get("speaker_id")
            or "unknown"
        )
        speaker_name = (
            participant.get("name")
            or participant.get("display_name")
            or participant.get("displayName")
            or seg.get("speaker_name")
            or seg.get("participant_name")
            or seg.get("participantName")
            or speaker_obj.get("name")
            or speaker_obj.get("display_name")
            or speaker_obj.get("displayName")
            or speaker
        )
        speaker_id = (
            participant.get("id")
            or seg.get("speaker_id")
            or seg.get("participant_id")
            or seg.get("participantId")
            or speaker
        )

        peid = hashlib.sha256(f"{bot_id}:{speaker_id}:{text[:50]}".encode()).hexdigest()[:32]

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
            "speaker_id": str(speaker_id),
            "speaker_name": str(speaker_name),
            "speaker_role": "customer",
            "text": text,
            "offset_seconds": offset,
            "provider": "recall",
            "provider_event_id": peid,
        }
        if peid in seen_ids:
            continue

        seen_ids.add(peid)
        new_count += 1
        new_events.append(event)
        await channel.broadcast(call_id, transcript_event_to_ws(event))

        async def _persist_analyze_and_broadcast(ev: Dict[str, Any] = event) -> None:
            try:
                stored = await asyncio.to_thread(repo.append_transcript_event, ctx, call_id, ev)
                if stored.get("_deduped"):
                    return
                result = await asyncio.to_thread(
                    _orch.dispatch_live_segment,
                    ctx,
                    call_id,
                    ev,
                    elapsed_seconds=int(ev.get("offset_seconds", 0)),
                )
                for msg in result.get("ws_messages") or []:
                    await channel.broadcast(call_id, msg)
            except Exception:
                pass

        asyncio.create_task(_persist_analyze_and_broadcast())

    return {
        "ok": True,
        "new_segments": new_count,
        "total_from_recall": len(raw_segments),
        "events": new_events,
    }


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
