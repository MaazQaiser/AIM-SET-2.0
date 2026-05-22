from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mem_key(ctx: TenantContext, call_id: str) -> str:
    _, clerk_key = resolve_kb_tenant(ctx)
    return f"{clerk_key}:{call_id}"


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
        row = {
            "call_id": call_id,
            "status": "live",
            "provider": provider,
            "provider_meeting_id": provider_meeting_id,
            "started_at": _now_iso(),
            "ended_at": None,
            "summary": {},
        }
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        if get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").upsert(
                    {
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "status": "live",
                        "provider": provider,
                        "provider_meeting_id": provider_meeting_id,
                        "summary": {},
                    }
                ).execute()
            except Exception:
                pass
        store = get_memory_store()
        store.live_sessions.setdefault(clerk_key, {})[call_id] = row
        return row

    def get_session(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        if get_settings().supabase_configured:
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
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        if get_settings().supabase_configured:
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
        sess = self.get_or_create_session(ctx, call_id, provider=provider, provider_meeting_id=provider_meeting_id)
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        if get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").upsert(
                    {
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "status": sess.get("status", "live"),
                        "provider": provider,
                        "provider_meeting_id": provider_meeting_id,
                        "summary": sess.get("summary") or {},
                    }
                ).execute()
            except Exception:
                pass
        get_memory_store().live_sessions.setdefault(clerk_key, {})[call_id] = {
            **sess,
            "provider_meeting_id": provider_meeting_id,
            "provider": provider,
        }
        return get_memory_store().live_sessions[clerk_key][call_id]

    def append_transcript_event(
        self,
        ctx: TenantContext,
        call_id: str,
        event: Dict[str, Any],
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        event_id = event.get("id") or str(uuid.uuid4())
        row = {
            "id": event_id,
            "call_id": call_id,
            "speaker_id": event.get("speaker_id", "unknown"),
            "speaker_role": event.get("speaker_role"),
            "text": event.get("text", ""),
            "offset_seconds": float(event.get("offset_seconds") or 0),
            "keywords": event.get("keywords") or [],
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
                return row
            # Check Supabase
            if get_settings().supabase_configured:
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
                        return row
                except Exception:
                    pass
        if get_settings().supabase_configured:
            try:
                get_supabase().table("call_transcript_events").insert(
                    {
                        "id": event_id,
                        "tenant_id": tenant_uuid,
                        "call_id": call_id,
                        "speaker_id": row["speaker_id"],
                        "speaker_role": row["speaker_role"],
                        "text": row["text"],
                        "offset_seconds": row["offset_seconds"],
                        "keywords": row["keywords"],
                        "provider": row["provider"],
                        "provider_event_id": row["provider_event_id"],
                    }
                ).execute()
            except Exception:
                pass
        store = get_memory_store()
        store.transcript_events.setdefault(clerk_key, {}).setdefault(call_id, []).append(row)
        if len(store.transcript_events[clerk_key][call_id]) > 500:
            store.transcript_events[clerk_key][call_id] = store.transcript_events[clerk_key][call_id][-500:]
        return row

    def list_transcript_events(
        self, ctx: TenantContext, call_id: str, *, limit: int = 200
    ) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        if get_settings().supabase_configured:
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
                return [_event_from_row(r) for r in (res.data or [])]
            except Exception:
                pass
        return list(get_memory_store().transcript_events.get(clerk_key, {}).get(call_id, []))[-limit:]

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
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
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
        if get_settings().supabase_configured:
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
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        acted_at = _now_iso()
        if get_settings().supabase_configured:
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
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        if get_settings().supabase_configured:
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
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        ended_at = _now_iso()
        if get_settings().supabase_configured:
            try:
                get_supabase().table("call_live_sessions").update(
                    {"status": "ended", "ended_at": ended_at, "summary": summary}
                ).eq("tenant_id", tenant_uuid).eq("call_id", call_id).execute()
            except Exception:
                pass
        sess = get_memory_store().live_sessions.setdefault(clerk_key, {}).get(call_id) or {}
        sess.update({"status": "ended", "ended_at": ended_at, "summary": summary})
        get_memory_store().live_sessions.setdefault(clerk_key, {})[call_id] = sess
        return sess


def _session_from_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "call_id": row.get("call_id"),
        "status": row.get("status", "live"),
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
        "speaker_role": row.get("speaker_role"),
        "text": row.get("text"),
        "offset_seconds": float(row.get("offset_seconds") or 0),
        "keywords": row.get("keywords") or [],
        "provider": row.get("provider"),
        "provider_event_id": row.get("provider_event_id"),
        "created_at": row.get("created_at"),
    }


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
