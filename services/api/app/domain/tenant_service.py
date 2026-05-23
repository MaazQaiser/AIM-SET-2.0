from __future__ import annotations

import uuid
from functools import lru_cache
from typing import Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.deps import get_supabase
from app.domain.memory_store import get_memory_store
from app.domain.supabase_helpers import run_with_timeout


def _deterministic_tenant_uuid(clerk_key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dc-copilot-tenant:{clerk_key}"))


class TenantService:
    """Resolve Clerk org / tenant header to Postgres tenant UUID."""

    def resolve(self, ctx: TenantContext) -> Tuple[str, str]:
        """
        Returns (tenant_uuid, clerk_key).
        clerk_key is the stable string used for in-memory fallback.
        """
        clerk_key = (ctx.clerk_org_id or ctx.tenant_id).strip()
        settings = get_settings()

        if settings.supabase_configured:
            def _resolve_from_db() -> Optional[str]:
                supabase = get_supabase()
                existing = (
                    supabase.table("tenants")
                    .select("id")
                    .eq("clerk_org_id", clerk_key)
                    .limit(1)
                    .execute()
                )
                rows = existing.data or []
                if rows:
                    return str(rows[0]["id"])

                inserted = (
                    supabase.table("tenants")
                    .insert({"clerk_org_id": clerk_key, "name": clerk_key})
                    .execute()
                )
                if inserted.data:
                    return str(inserted.data[0]["id"])
                return None

            # Upload/ingest need a real tenants row (kb_assets.tenant_id FK). Do not fall back
            # to an in-memory UUID that was never inserted.
            tenant_uuid = run_with_timeout(_resolve_from_db, default=None, timeout_sec=12.0)
            if tenant_uuid:
                return tenant_uuid, clerk_key
            raise RuntimeError(
                f"Could not resolve tenant '{clerk_key}' in Supabase. "
                "Check SUPABASE_URL, service role key, and network connectivity."
            )

        store = get_memory_store()
        mapped = store.tenant_uuid_map.get(clerk_key)
        if mapped:
            return mapped, clerk_key

        tid = _deterministic_tenant_uuid(clerk_key)
        store.tenant_uuid_map[clerk_key] = tid
        return tid, clerk_key


@lru_cache
def get_tenant_service() -> TenantService:
    return TenantService()
