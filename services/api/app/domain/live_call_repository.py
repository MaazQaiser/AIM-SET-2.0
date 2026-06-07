from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store

_logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fallback_tenant_key(ctx: TenantContext) -> str:
    return ctx.clerk_org_id or ctx.tenant_id or ctx.user_id or "local-dev"


def _memory_keys(ctx: TenantContext, clerk_key: str) -> List[str]:
    return list(dict.fromkeys([clerk_key, _fallback_tenant_key(ctx)]))


def _resolve_live_tenant(ctx: TenantContext) -> tuple[str, str, bool]:
    if not get_settings().supabase_configured:
        fallback = _fallback_tenant_key(ctx)
        return fallback, fallback, False
    try:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        return tenant_uuid, clerk_key, True
    except Exception as exc:
        fallback = _fallback_tenant_key(ctx)
        _logger.warning(
            "tenant resolution failed for live call repository; using memory fallback tenant_key=%s error=%s",
            fallback,
            exc,
        )
        return fallback, fallback, False


class LiveCallRepository:
    def get_or_create_session(
        self,
        ctx: TenantContext,
        call_id: str,
        *,
        provider: str = "recall",
        provider_meeting_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self.get_session(ctx, call_id)
        if existing:
            if provider_meeting_id and not existing.get("provider_meeting_id"):
                return self.link_provider_meeting(ctx, call_id, provider_meeting_id, provider=provider)
            return existing
        initial_status = "live" if provider_meeting_id else None
        row = {
            "call_id": call_id,
            "status": initial_status,
            "provider": provider,
            "provider_meeting_id": provider_meeting_id,
            "started_at": _now_iso(),
            "ended_at": None,
            "summary": {},
        }
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        if tenant_resolved and get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").upsert(
                    {
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "status": initial_status,
                        "provider": provider,
                        "provider_meeting_id": provider_meeting_id,
                        "summary": {},
                    }
                ).execute()
            except Exception:
                pass
        store = get_memory_store()
        for key in _memory_keys(ctx, clerk_key):
            store.live_sessions.setdefault(key, {})[call_id] = row
        return row

    def get_session(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        if tenant_resolved and get_settings().supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("call_live_sessions")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .eq("call_id", call_id)
                    .limit(1)
                    .execute()
                )
                rows = res.data or []
                if rows:
                    return _session_from_row(rows[0])
            except Exception:
                pass
        return get_memory_store().live_sessions.get(clerk_key, {}).get(call_id)

    def resolve_call_by_provider_meeting(
        self, ctx: TenantContext, provider_meeting_id: str
    ) -> Optional[str]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        if tenant_resolved and get_settings().supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("call_live_sessions")
                    .select("call_id")
                    .eq("tenant_id", tenant_uuid)
                    .eq("provider_meeting_id", provider_meeting_id)
                    .limit(1)
                    .execute()
                )
                rows = res.data or []
                if rows:
                    return rows[0].get("call_id")
                res2 = (
                    get_supabase()
                    .table("calls")
                    .select("id, metadata")
                    .eq("tenant_id", tenant_uuid)
                    .execute()
                )
                for row in res2.data or []:
                    meta = row.get("metadata") or {}
                    if meta.get("recall_meeting_id") == provider_meeting_id:
                        return row["id"]
            except Exception:
                pass
        for call_id, sess in get_memory_store().live_sessions.get(clerk_key, {}).items():
            if sess.get("provider_meeting_id") == provider_meeting_id:
                return call_id
        return None

    def link_provider_meeting(
        self,
        ctx: TenantContext,
        call_id: str,
        provider_meeting_id: str,
        *,
        provider: str = "recall",
    ) -> Dict[str, Any]:
        sess = self.get_session(ctx, call_id) or {
            "call_id": call_id,
            "status": None,
            "provider": provider,
            "provider_meeting_id": None,
            "started_at": _now_iso(),
            "ended_at": None,
            "summary": {},
        }
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        linked = {
            **sess,
            "status": "live",
            "provider_meeting_id": provider_meeting_id,
            "provider": provider,
        }
        if tenant_resolved and get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").upsert(
                    {
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "status": "live",
                        "provider": provider,
                        "provider_meeting_id": provider_meeting_id,
                        "summary": linked.get("summary") or {},
                    }
                ).execute()
            except Exception:
                pass
        store = get_memory_store()
        for key in _memory_keys(ctx, clerk_key):
            store.live_sessions.setdefault(key, {})[call_id] = linked
        return store.live_sessions[clerk_key][call_id]

    def append_transcript_event(
        self,
        ctx: TenantContext,
        call_id: str,
        event: Dict[str, Any],
    ) -> Dict[str, Any]:
        self.mark_session_live(ctx, call_id, provider=event.get("provider", "recall"))
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        event_id = event.get("id") or str(uuid.uuid4())
        row = {
            "id": event_id,
            "call_id": call_id,
            "speaker_id": event.get("speaker_id", "unknown"),
            "speaker_name": event.get("speaker_name") or event.get("speaker_id", "unknown"),
            "speaker_role": event.get("speaker_role"),
            "text": event.get("text", ""),
            "offset_seconds": float(event.get("offset_seconds") or 0),
            "keywords": event.get("keywords") or [],
            "sentiment": event.get("sentiment"),
            "signal_type": event.get("signal_type") or event.get("signalType"),
            "provider": event.get("provider", "recall"),
            "provider_event_id": event.get("provider_event_id"),
            "created_at": event.get("created_at") or _now_iso(),
        }
        # Dedup by provider_event_id — check both Supabase and in-memory store
        peid = row.get("provider_event_id")
        if peid:
            # Check in-memory first (fast path)
            mem_events = get_memory_store().transcript_events.get(clerk_key, {}).get(call_id, [])
            if any(e.get("provider_event_id") == peid for e in mem_events):
                row["_deduped"] = True
                return row
            # Check Supabase
            if tenant_resolved and get_settings().supabase_configured:
                try:
                    existing = (
                        get_supabase()
                        .table("call_transcript_events")
                        .select("id")
                        .eq("tenant_id", tenant_uuid)
                        .eq("call_id", call_id)
                        .eq("provider_event_id", peid)
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        row["_deduped"] = True
                        return row
                except Exception:
                    pass
        if tenant_resolved and get_settings().supabase_configured:
            transcript_payload = {
                "id": event_id,
                "tenant_id": tenant_uuid,
                "call_id": call_id,
                "speaker_id": row["speaker_id"],
                "speaker_name": row["speaker_name"],
                "speaker_role": row["speaker_role"],
                "text": row["text"],
                "offset_seconds": row["offset_seconds"],
                "keywords": row["keywords"],
                "sentiment": row["sentiment"],
                "signal_type": row["signal_type"],
                "provider": row["provider"],
                "provider_event_id": row["provider_event_id"],
            }
            try:
                get_supabase().table("call_transcript_events").insert(transcript_payload).execute()
            except Exception:
                try:
                    legacy_payload = dict(transcript_payload)
                    legacy_payload.pop("sentiment", None)
                    legacy_payload.pop("signal_type", None)
                    get_supabase().table("call_transcript_events").insert(legacy_payload).execute()
                except Exception:
                    try:
                        legacy_payload = dict(transcript_payload)
                        legacy_payload.pop("sentiment", None)
                        legacy_payload.pop("signal_type", None)
                        legacy_payload.pop("speaker_name", None)
                        get_supabase().table("call_transcript_events").insert(legacy_payload).execute()
                    except Exception:
                        pass
        store = get_memory_store()
        store.transcript_events.setdefault(clerk_key, {}).setdefault(call_id, []).append(row)
        if len(store.transcript_events[clerk_key][call_id]) > 500:
            store.transcript_events[clerk_key][call_id] = store.transcript_events[clerk_key][call_id][-500:]
        return row

    def mark_session_live(
        self,
        ctx: TenantContext,
        call_id: str,
        *,
        provider: str = "recall",
    ) -> Dict[str, Any]:
        existing = self.get_session(ctx, call_id) or {
            "call_id": call_id,
            "status": None,
            "provider": provider,
            "provider_meeting_id": None,
            "started_at": _now_iso(),
            "ended_at": None,
            "summary": {},
        }
        if existing.get("status") == "live":
            return existing

        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        live = {
            **existing,
            "status": "live",
            "provider": existing.get("provider") or provider,
            "started_at": existing.get("started_at") or _now_iso(),
            "ended_at": None,
        }
        if tenant_resolved and get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").upsert(
                    {
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "status": "live",
                        "provider": live.get("provider") or provider,
                        "provider_meeting_id": live.get("provider_meeting_id"),
                        "summary": live.get("summary") or {},
                    }
                ).execute()
            except Exception:
                pass
        store = get_memory_store()
        for key in _memory_keys(ctx, clerk_key):
            store.live_sessions.setdefault(key, {})[call_id] = live
        return live

    def update_transcript_event_analysis(
        self,
        ctx: TenantContext,
        call_id: str,
        event_id: str,
        *,
        keywords: Optional[List[str]] = None,
        sentiment: Optional[str] = None,
        signal_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        payload: Dict[str, Any] = {}
        if keywords is not None:
            payload["keywords"] = keywords
        if sentiment is not None:
            payload["sentiment"] = sentiment
        if signal_type is not None:
            payload["signal_type"] = signal_type
        if not payload:
            return None

        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        if tenant_resolved and get_settings().supabase_configured:
            try:
                (
                    get_supabase()
                    .table("call_transcript_events")
                    .update(payload)
                    .eq("tenant_id", tenant_uuid)
                    .eq("call_id", call_id)
                    .eq("id", event_id)
                    .execute()
                )
            except Exception:
                legacy_payload = {
                    key: value
                    for key, value in payload.items()
                    if key not in ("sentiment", "signal_type")
                }
                if legacy_payload:
                    try:
                        (
                            get_supabase()
                            .table("call_transcript_events")
                            .update(legacy_payload)
                            .eq("tenant_id", tenant_uuid)
                            .eq("call_id", call_id)
                            .eq("id", event_id)
                            .execute()
                        )
                    except Exception:
                        pass

        events = get_memory_store().transcript_events.get(clerk_key, {}).get(call_id, [])
        for item in events:
            if item.get("id") == event_id:
                item.update(payload)
                return item
        return None

    def list_transcript_events(
        self, ctx: TenantContext, call_id: str, *, limit: int = 200
    ) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        memory_events = list(get_memory_store().transcript_events.get(clerk_key, {}).get(call_id, []))
        if tenant_resolved and get_settings().supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("call_transcript_events")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .eq("call_id", call_id)
                    .order("created_at", desc=False)
                    .limit(limit)
                    .execute()
                )
                remote_events = [_event_from_row(r) for r in (res.data or [])]
                if memory_events:
                    return _merge_transcript_events(remote_events, memory_events)[-limit:]
                return remote_events[-limit:]
            except Exception:
                pass
        return memory_events[-limit:]

    def append_suggestion(
        self,
        ctx: TenantContext,
        call_id: str,
        *,
        operation: str,
        payload: Dict[str, Any],
        target_role: Optional[str] = None,
        transcript_offset_seconds: float = 0,
        confidence: float = 0,
        trace_id: Optional[str] = None,
        suggestion_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        sid = suggestion_id or str(uuid.uuid4())
        shown_at = _now_iso()
        row = {
            "id": sid,
            "call_id": call_id,
            "operation": operation,
            "target_role": target_role,
            "payload": payload,
            "transcript_offset_seconds": transcript_offset_seconds,
            "confidence": confidence,
            "status": "shown",
            "shown_at": shown_at,
            "acted_at": None,
            "trace_id": trace_id,
        }
        if tenant_resolved and get_settings().supabase_configured:
            try:
                get_supabase().table("live_call_suggestions").insert(
                    {
                        "id": sid,
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "operation": operation,
                        "target_role": target_role,
                        "payload": payload,
                        "transcript_offset_seconds": transcript_offset_seconds,
                        "confidence": confidence,
                        "status": "shown",
                        "shown_at": shown_at,
                        "trace_id": trace_id,
                    }
                ).execute()
            except Exception:
                pass
        store = get_memory_store()
        store.live_suggestions.setdefault(clerk_key, {}).setdefault(call_id, []).append(row)
        return row

    def update_suggestion_status(
        self,
        ctx: TenantContext,
        call_id: str,
        suggestion_id: str,
        status: str,
    ) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        acted_at = _now_iso()
        if tenant_resolved and get_settings().supabase_configured:
            try:
                get_supabase().table("live_call_suggestions").update(
                    {"status": status, "acted_at": acted_at}
                ).eq("tenant_id", tenant_uuid).eq("call_id", call_id).eq("id", suggestion_id).execute()
            except Exception:
                pass
        for item in get_memory_store().live_suggestions.get(clerk_key, {}).get(call_id, []):
            if item["id"] == suggestion_id:
                item["status"] = status
                item["acted_at"] = acted_at
                return item
        return None

    def list_suggestions(
        self, ctx: TenantContext, call_id: str, *, limit: int = 100
    ) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        if tenant_resolved and get_settings().supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("live_call_suggestions")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .eq("call_id", call_id)
                    .order("shown_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                return [_suggestion_from_row(r) for r in (res.data or [])]
            except Exception:
                pass
        return list(get_memory_store().live_suggestions.get(clerk_key, {}).get(call_id, []))[-limit:]

    def end_session(self, ctx: TenantContext, call_id: str, summary: Dict[str, Any]) -> Dict[str, Any]:
        tenant_uuid, clerk_key, tenant_resolved = _resolve_live_tenant(ctx)
        ended_at = _now_iso()
        if tenant_resolved and get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").update(
                    {"status": "ended", "ended_at": ended_at, "summary": summary}
                ).eq("tenant_id", tenant_uuid).eq("call_id", call_id).execute()
            except Exception:
                pass
        store = get_memory_store()
        sess = store.live_sessions.setdefault(clerk_key, {}).get(call_id) or {}
        sess.update({"status": "ended", "ended_at": ended_at, "summary": summary})
        for key in _memory_keys(ctx, clerk_key):
            store.live_sessions.setdefault(key, {})[call_id] = sess
        return sess


def _session_from_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "call_id": row.get("call_id"),
        "status": row.get("status"),
        "provider": row.get("provider", "recall"),
        "provider_meeting_id": row.get("provider_meeting_id"),
        "started_at": row.get("started_at"),
        "ended_at": row.get("ended_at"),
        "summary": row.get("summary") or {},
    }


def _event_from_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "call_id": row.get("call_id"),
        "speaker_id": row.get("speaker_id"),
        "speaker_name": row.get("speaker_name") or row.get("speaker_id"),
        "speaker_role": row.get("speaker_role"),
        "text": row.get("text"),
        "offset_seconds": float(row.get("offset_seconds") or 0),
        "keywords": row.get("keywords") or [],
        "sentiment": row.get("sentiment"),
        "signal_type": row.get("signal_type"),
        "provider": row.get("provider"),
        "provider_event_id": row.get("provider_event_id"),
        "created_at": row.get("created_at"),
    }


def _transcript_event_key(event: Dict[str, Any]) -> str:
    provider_event_id = str(event.get("provider_event_id") or "").strip()
    if provider_event_id:
        return f"provider:{provider_event_id}"
    event_id = str(event.get("id") or "").strip()
    if event_id:
        return f"id:{event_id}"
    text = _compact_whitespace(str(event.get("text") or "").strip().lower())[:160]
    speaker = str(event.get("speaker_id") or event.get("speaker_name") or "").strip().lower()
    offset = float(event.get("offset_seconds") or 0)
    return f"fallback:{speaker}:{offset:.2f}:{text}"


def _transcript_event_score(event: Dict[str, Any]) -> int:
    return sum(
        1
        for key in ("keywords", "sentiment", "signal_type", "created_at")
        if event.get(key)
    )


def _transcript_event_sort_key(event: Dict[str, Any]) -> tuple[str, float, str]:
    return (
        str(event.get("created_at") or ""),
        float(event.get("offset_seconds") or 0),
        str(event.get("id") or event.get("provider_event_id") or ""),
    )


def _merge_transcript_events(*event_groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_key: Dict[str, Dict[str, Any]] = {}
    for group in event_groups:
        for raw_event in group:
            event = _event_from_row(raw_event)
            if not str(event.get("text") or "").strip():
                continue
            key = _transcript_event_key(event)
            existing = by_key.get(key)
            if not existing or _transcript_event_score(event) >= _transcript_event_score(existing):
                by_key[key] = event
    return sorted(by_key.values(), key=_transcript_event_sort_key)


def _compact_whitespace(value: str) -> str:
    return " ".join(value.split())


def _suggestion_from_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "call_id": row.get("call_id"),
        "operation": row.get("operation"),
        "target_role": row.get("target_role"),
        "payload": row.get("payload") or {},
        "transcript_offset_seconds": float(row.get("transcript_offset_seconds") or 0),
        "confidence": float(row.get("confidence") or 0),
        "status": row.get("status", "shown"),
        "shown_at": row.get("shown_at"),
        "acted_at": row.get("acted_at"),
        "trace_id": row.get("trace_id"),
    }


_repo: Optional[LiveCallRepository] = None


def get_live_call_repository() -> LiveCallRepository:
    global _repo
    if _repo is None:
        _repo = LiveCallRepository()
    return _repo
