from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.kb_tenancy import resolve_team_tenant
from app.domain.memory_store import get_memory_store
from app.deps import get_supabase


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DailyBriefingsRepository:
    def _keys(self, ctx: TenantContext) -> tuple[str, str]:
        tenant_uuid, clerk_key = resolve_team_tenant(ctx)
        return tenant_uuid, clerk_key

    def get(self, ctx: TenantContext, briefing_date: str) -> Optional[Dict[str, Any]]:
        _, clerk_key = self._keys(ctx)
        memory_key = f"{clerk_key}:{briefing_date}"
        cached = get_memory_store().daily_briefings.get(memory_key)
        if cached:
            return {**cached, "cached": True}

        settings = get_settings()
        if not settings.supabase_configured:
            return None

        tenant_uuid, clerk_key = self._keys(ctx)
        try:
            result = (
                get_supabase()
                .table("daily_briefings")
                .select("payload, generated_at")
                .eq("tenant_id", tenant_uuid)
                .eq("briefing_date", briefing_date)
                .limit(1)
                .execute()
            )
        except Exception:
            return None

        rows = result.data or []
        if not rows:
            return None

        payload = rows[0].get("payload") or {}
        if not isinstance(payload, dict):
            return None
        generated_at = rows[0].get("generated_at")
        out = {
            **payload,
            "briefingDate": briefing_date,
            "generatedAt": generated_at,
            "cached": True,
        }
        get_memory_store().daily_briefings[memory_key] = out
        return out

    def save(
        self,
        ctx: TenantContext,
        briefing_date: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        tenant_uuid, clerk_key = self._keys(ctx)
        memory_key = f"{clerk_key}:{briefing_date}"
        generated_at = _now_iso()
        stored = {
            **payload,
            "briefingDate": briefing_date,
            "generatedAt": generated_at,
            "cached": False,
        }
        get_memory_store().daily_briefings[memory_key] = stored

        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().table("daily_briefings").upsert(
                    {
                        "tenant_id": tenant_uuid,
                        "briefing_date": briefing_date,
                        "payload": payload,
                        "generated_at": generated_at,
                    },
                    on_conflict="tenant_id,briefing_date",
                ).execute()
            except Exception:
                pass

        return stored


_repo: Optional[DailyBriefingsRepository] = None


def get_daily_briefings_repository() -> DailyBriefingsRepository:
    global _repo
    if _repo is None:
        _repo = DailyBriefingsRepository()
    return _repo
