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
from app.domain.tenant_service import get_tenant_service


def slugify_company(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:56]
    return f"call-{slug}" if slug else f"call-{int(datetime.now().timestamp())}"


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
            }
        )
    return calls


class CallsService:
    def __init__(self) -> None:
        self._dc = get_dc_notes_repository()
        self._tenants = get_tenant_service()

    def _tenant_uuid(self, ctx: TenantContext) -> str:
        tenant_uuid, _ = self._tenants.resolve(ctx)
        return tenant_uuid

    def sync_from_dc_notes(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        notes = self._dc.get_notes(ctx)
        calls = build_calls_from_pre_dc(notes["pre_dc_records"], notes["post_dc_records"])
        self._persist_calls(ctx, calls)
        return calls

    def _persist_calls(self, ctx: TenantContext, calls: List[Dict[str, Any]]) -> None:
        if not calls:
            return
        _, clerk_key = self._tenants.resolve(ctx)
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
                },
            }
            for c in calls
        ]
        if rows:
            supabase.table("calls").upsert(rows).execute()

    def list_calls(self, ctx: TenantContext) -> List[Dict[str, Any]]:
        _, clerk_key = self._tenants.resolve(ctx)
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
        return next((c for c in self.list_calls(ctx) if c["id"] == call_id), None)

    def get_brief(self, ctx: TenantContext, call_id: str) -> Optional[Dict[str, Any]]:
        _, clerk_key = self._tenants.resolve(ctx)
        if not get_settings().supabase_configured:
            return get_memory_store().get_call_brief(clerk_key, call_id)
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        try:
            result = execute_with_retry(
                lambda: (
                    supabase.table("call_briefs")
                    .select("payload")
                    .eq("tenant_id", tenant_uuid)
                    .eq("call_id", call_id)
                    .order("version", desc=True)
                    .limit(1)
                    .execute()
                )
            )
        except Exception:
            return get_memory_store().get_call_brief(clerk_key, call_id)
        rows = result.data or []
        if rows:
            payload = rows[0].get("payload")
            if payload:
                get_memory_store().save_call_brief(clerk_key, call_id, payload)
            return payload
        return None

    def save_brief(self, ctx: TenantContext, call_id: str, payload: Dict[str, Any]) -> None:
        _, clerk_key = self._tenants.resolve(ctx)
        if not get_settings().supabase_configured:
            get_memory_store().save_call_brief(clerk_key, call_id, payload)
            for call in get_memory_store().list_calls(clerk_key):
                if call["id"] == call_id:
                    call["briefReady"] = True
                    break
            return
        tenant_uuid = self._tenant_uuid(ctx)
        supabase = get_supabase()
        supabase.table("call_briefs").insert(
            {
                "tenant_id": tenant_uuid,
                "call_id": call_id,
                "version": 1,
                "payload": payload,
                "citations": payload.get("citations", []),
            }
        ).execute()

        supabase.table("calls").update({"brief_ready": True}).eq("tenant_id", tenant_uuid).eq("id", call_id).execute()

    def save_live_signals(self, ctx: TenantContext, call_id: str, snapshot: Dict[str, Any]) -> None:
        _, clerk_key = self._tenants.resolve(ctx)
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
    }
