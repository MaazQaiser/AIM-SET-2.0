from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.dc_notes_repository import get_dc_notes_repository
from app.domain.memory_store import get_memory_store
from app.domain.supabase_utils import execute_with_retry
from app.domain.kb_tenancy import resolve_team_tenant


def slugify_company(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:56]
    return f"call-{slug}" if slug else f"call-{int(datetime.now().timestamp())}"


def call_id_aliases(call_id: str) -> List[str]:
    """Support legacy demo URLs that omit the persisted `call-` prefix."""
    aliases = [call_id]
    if call_id.startswith("call-"):
        aliases.append(call_id.removeprefix("call-"))
    else:
        aliases.append(f"call-{call_id}")
    return list(dict.fromkeys(aliases))


def build_calls_from_pre_dc(
    pre_rows: List[Dict[str, Any]], post_rows: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    calls: List[Dict[str, Any]] = []
    for row in pre_rows:
        fields = row.get("fields") or {}
        company = (fields.get("Company Name-PreDC") or "").strip()
        if not company:
            continue
        call_id = slugify_company(company)
        calls.append(
            {
                "id": call_id,
                "accountName": company,
                "scheduledAt": datetime.now(timezone.utc).isoformat(),
                "status": "upcoming",
                "briefReady": True,
                "pod": [],
                "leadName": fields.get("Lead Name-PreDC"),
                "industry": fields.get("Industry - PreDC"),
                "meetingUrl": _meeting_url_from_fields(fields),
            }
        )
    return calls


class CallsService:
    def __init__(self) -> None:
        self._dc = get_dc_notes_repository()

    def _tenant_uuid(self, ctx: TenantContext) -> str:
        tenant_uuid, _ = resolve_team_tenant(ctx)
        return tenant_uuid

    def _clerk_key(self, ctx: TenantContext) -> str:
        _, clerk_key = resolve_team_tenant(ctx)
        return clerk_key

    def sync_from_dc_notes(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        notes = self._dc.get_notes(ctx)
        calls = build_calls_from_pre_dc(notes["pre_dc_records"], notes["post_dc_records"])
        self._persist_calls(ctx, calls)
        return calls

    def _persist_calls(self, ctx: TenantContext, calls: List[Dict[str, Any]]) -> None:
        if not calls:
            return
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            get_memory_store().upsert_calls(clerk_key, calls)
            return
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        rows = [
            {
                "id": c["id"],
                "tenant_id": tenant_uuid,
                "account_slug": c["id"],
                "account_name": c["accountName"],
                "scheduled_at": c.get("scheduledAt") or datetime.now(timezone.utc).isoformat(),
                "status": c.get("status", "upcoming"),
                "brief_ready": bool(c.get("briefReady")),
                "metadata": {
                    "leadName": c.get("leadName"),
                    "industry": c.get("industry"),
                    "meetingUrl": c.get("meetingUrl"),
                },
            }
            for c in calls
        ]
        if rows:
            supabase.table("calls").upsert(rows).execute()

    def list_calls(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            mem_calls = get_memory_store().list_calls(clerk_key)
            if mem_calls:
                return mem_calls
            return self.sync_from_dc_notes(ctx)
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        try:
            result = execute_with_retry(
                lambda: (
                    supabase.table("calls")
                    .select("id, account_name, scheduled_at, status, brief_ready, metadata")
                    .eq("tenant_id", tenant_uuid)
                    .order("scheduled_at", desc=True)
                    .execute()
                )
            )
        except Exception:
            mem_calls = get_memory_store().list_calls(clerk_key)
            if mem_calls:
                return mem_calls
            raise
        rows = result.data or []
        if rows:
            calls = [_row_to_call(r) for r in rows]
            get_memory_store().upsert_calls(clerk_key, calls)
            return calls

        return self.sync_from_dc_notes(ctx)

    def get_call(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        aliases = set(call_id_aliases(call_id))
        return next((c for c in self.list_calls(ctx) if c["id"] in aliases), None)

    def get_brief(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            for alias in call_id_aliases(call_id):
                brief = get_memory_store().get_call_brief(clerk_key, alias)
                if brief:
                    return brief
            return None
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        for alias in call_id_aliases(call_id):
            try:
                result = execute_with_retry(
                    lambda: (
                        supabase.table("call_briefs")
                        .select("payload")
                        .eq("tenant_id", tenant_uuid)
                        .eq("call_id", alias)
                        .order("version", desc=True)
                        .limit(1)
                        .execute()
                    )
                )
            except Exception:
                brief = get_memory_store().get_call_brief(clerk_key, alias)
                if brief:
                    return brief
                continue
            rows = result.data or []
            if rows:
                payload = rows[0].get("payload")
                if payload:
                    get_memory_store().save_call_brief(clerk_key, alias, payload)
                    if alias != call_id:
                        get_memory_store().save_call_brief(clerk_key, call_id, payload)
                return payload
        return None

    def save_brief(self, ctx: TenantContext, call_id: str, payload: Dict[str, Any]) -> None:
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            get_memory_store().save_call_brief(clerk_key, call_id, payload)
            for call in get_memory_store().list_calls(clerk_key):
                if call["id"] == call_id:
                    call["briefReady"] = True
                    break
            return
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        supabase.table("call_briefs").upsert(
            {
                "tenant_id": tenant_uuid,
                "call_id": call_id,
                "version": 1,
                "payload": payload,
                "citations": payload.get("citations", []),
            },
            on_conflict="tenant_id,call_id,version",
        ).execute()

        supabase.table("calls").update({"brief_ready": True}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()

    def get_post_review(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        clerk_key = self._clerk_key(ctx)
        for alias in call_id_aliases(call_id):
            cached = get_memory_store().get_post_review(clerk_key, alias)
            if cached:
                return cached

        if not get_settings().supabase_configured:
            return None

        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        for alias in call_id_aliases(call_id):
            try:
                result = execute_with_retry(
                    lambda: (
                        supabase.table("calls")
                        .select("metadata")
                        .eq("tenant_id", tenant_uuid)
                        .eq("id", alias)
                        .limit(1)
                        .execute()
                    )
                )
            except Exception:
                continue
            rows = result.data or []
            if not rows:
                continue
            metadata = rows[0].get("metadata") or {}
            if not isinstance(metadata, dict):
                continue
            payload = metadata.get("post_call")
            if isinstance(payload, dict):
                get_memory_store().save_post_review(clerk_key, alias, payload)
                if alias != call_id:
                    get_memory_store().save_post_review(clerk_key, call_id, payload)
                return payload
        return None

    def save_post_review(self, ctx: TenantContext, call_id: str, payload: Dict[str, Any]) -> None:
        clerk_key = self._clerk_key(ctx)
        get_memory_store().save_post_review(clerk_key, call_id, payload)

        if not get_settings().supabase_configured:
            call = self.get_call(ctx, call_id)
            if call:
                meta = call.get("metadata") or {}
                if not isinstance(meta, dict):
                    meta = {}
                meta["post_call"] = payload
                call["metadata"] = meta
                call["status"] = "completed"
                get_memory_store().upsert_calls(clerk_key, [call])
            return

        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        meta: Dict[str, Any] = {}
        try:
            result = execute_with_retry(
                lambda: (
                    supabase.table("calls")
                    .select("metadata")
                    .eq("tenant_id", tenant_uuid)
                    .eq("id", call_id)
                    .limit(1)
                    .execute()
                )
            )
            rows = result.data or []
            if rows and isinstance(rows[0].get("metadata"), dict):
                meta = rows[0]["metadata"]
        except Exception:
            call = self.get_call(ctx, call_id)
            meta = (call or {}).get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        meta["post_call"] = payload
        supabase.table("calls").update({"metadata": meta, "status": "completed"}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()

    def save_live_signals(self, ctx: TenantContext, call_id: str, snapshot: Dict[str, Any]) -> None:
        clerk_key = self._clerk_key(ctx)
        if not get_settings().supabase_configured:
            get_memory_store().save_live_signals(clerk_key, call_id, snapshot)
            call = self.get_call(ctx, call_id)
            if call:
                meta = call.get("metadata") or {}
                if not isinstance(meta, dict):
                    meta = {}
                meta["live_signals"] = snapshot
                call["metadata"] = meta
                get_memory_store().upsert_calls(clerk_key, [call])
            return
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        call = self.get_call(ctx, call_id)
        meta = (call or {}).get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        meta["live_signals"] = snapshot
        supabase.table("calls").update({"metadata": meta}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()


def _row_to_call(row: Dict[str, Any]) -> Dict[str, Any]:
    meta = row.get("metadata") or {}
    return {
        "id": row["id"],
        "accountName": row.get("account_name") or row["id"],
        "scheduledAt": row.get("scheduled_at"),
        "status": row.get("status", "upcoming"),
        "briefReady": bool(row.get("brief_ready")),
        "pod": [],
        "leadName": meta.get("leadName"),
        "industry": meta.get("industry"),
        "meetingUrl": meta.get("meetingUrl") or meta.get("meeting_url") or meta.get("recall_meeting_url"),
    }


def _meeting_url_from_fields(fields: Dict[str, Any]) -> Optional[str]:
    for key in (
        "Meeting URL",
        "Meeting Link",
        "Meeting URL-PreDC",
        "Meeting Link-PreDC",
        "Google Meet Link",
        "Zoom Link",
        "Teams Link",
    ):
        value = fields.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
