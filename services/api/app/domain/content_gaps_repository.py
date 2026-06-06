from __future__ import annotations

import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.memory_store import get_memory_store
from app.domain.tenant_service import get_tenant_service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row["id"]),
        "callId": row.get("call_id"),
        "source": row.get("source"),
        "gapKey": row.get("gap_key"),
        "name": row.get("name"),
        "artifactType": row.get("artifact_type") or "deck",
        "reason": row.get("reason"),
        "neededFor": row.get("needed_for"),
        "priority": int(row.get("priority") or 2),
        "status": row.get("status") or "open",
        "studioProjectId": str(row["studio_project_id"]) if row.get("studio_project_id") else None,
        "kbAssetId": row.get("kb_asset_id"),
        "createdAt": (row.get("created_at") or _now_iso())[:19],
        "updatedAt": (row.get("updated_at") or _now_iso())[:19],
    }


class ContentGapsRepository:
    def __init__(self) -> None:
        self._tenants = get_tenant_service()

    def list_gaps(
        self,
        ctx: TenantContext,
        *,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = self._tenants.resolve(ctx)
        settings = get_settings()
        if settings.supabase_configured:
            try:
                q = (
                    get_supabase()
                    .table("content_gaps")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .order("updated_at", desc=True)
                )
                if status:
                    q = q.eq("status", status)
                rows = q.execute().data or []
                api_rows = [_row_to_api(r) for r in rows]
                store = get_memory_store()
                store.content_gaps[clerk_key] = api_rows
                return api_rows
            except Exception:
                pass

        rows = get_memory_store().content_gaps.get(clerk_key, [])
        if status:
            rows = [r for r in rows if r.get("status") == status]
        return rows

    def upsert_gap(
        self,
        ctx: TenantContext,
        *,
        gap_key: str,
        source: str,
        name: str,
        artifact_type: str = "deck",
        call_id: Optional[str] = None,
        reason: Optional[str] = None,
        needed_for: Optional[str] = None,
        priority: int = 2,
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = self._tenants.resolve(ctx)
        existing = self._find_by_key(ctx, gap_key)
        if existing and existing.get("status") in ("resolved", "dismissed"):
            return existing

        gap_id = existing["id"] if existing else str(uuid.uuid4())
        row = {
            "id": gap_id,
            "tenant_id": tenant_uuid,
            "call_id": call_id,
            "source": source,
            "gap_key": gap_key,
            "name": name,
            "artifact_type": artifact_type,
            "reason": reason,
            "needed_for": needed_for,
            "priority": priority,
            "status": existing.get("status") if existing else "open",
            "updated_at": _now_iso(),
        }
        if not existing:
            row["created_at"] = _now_iso()

        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_gaps").upsert(row, on_conflict="tenant_id,gap_key").execute()
            except Exception:
                use_memory = True

        api = _row_to_api(row)
        store = get_memory_store()
        gaps = store.content_gaps.setdefault(clerk_key, [])
        replaced = False
        for i, g in enumerate(gaps):
            if g.get("gapKey") == gap_key or g.get("id") == gap_id:
                gaps[i] = api
                replaced = True
                break
        if not replaced:
            gaps.append(api)
        return api

    def patch_gap(
        self,
        ctx: TenantContext,
        gap_id: str,
        patch: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        resolved = self.get_gap(ctx, gap_id)
        if not resolved:
            return None
        gap_id = str(resolved["id"])
        tenant_uuid, clerk_key = self._tenants.resolve(ctx)
        db_patch: Dict[str, Any] = {"updated_at": _now_iso()}
        if "status" in patch:
            db_patch["status"] = patch["status"]
        if "studioProjectId" in patch:
            db_patch["studio_project_id"] = patch["studioProjectId"]
        if "kbAssetId" in patch:
            db_patch["kb_asset_id"] = patch["kbAssetId"]

        use_memory = not get_settings().supabase_configured
        if get_settings().supabase_configured:
            try:
                get_supabase().table("content_gaps").update(db_patch).eq("id", gap_id).eq(
                    "tenant_id", tenant_uuid
                ).execute()
            except Exception:
                use_memory = True

        store = get_memory_store()
        for g in store.content_gaps.get(clerk_key, []):
            if g.get("id") != gap_id:
                continue
            if "status" in patch:
                g["status"] = patch["status"]
            if "studioProjectId" in patch:
                g["studioProjectId"] = patch["studioProjectId"]
            if "kbAssetId" in patch:
                g["kbAssetId"] = patch["kbAssetId"]
            g["updatedAt"] = db_patch["updated_at"][:19]
            return g
        if use_memory:
            return None
        return self.get_gap(ctx, gap_id)

    def get_gap(self, ctx: TenantContext, gap_id: str) -> Optional[Dict[str, Any]]:
        for g in self.list_gaps(ctx):
            if g.get("id") == gap_id or g.get("gapKey") == gap_id:
                return g
        return None

    def _find_by_key(self, ctx: TenantContext, gap_key: str) -> Optional[Dict[str, Any]]:
        for g in self.list_gaps(ctx):
            if g.get("gapKey") == gap_key:
                return g
        return None


@lru_cache
def get_content_gaps_repository() -> ContentGapsRepository:
    return ContentGapsRepository()
