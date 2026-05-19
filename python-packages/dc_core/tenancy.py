from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str
    clerk_org_id: str | None = None

    @staticmethod
    def from_headers(
        user_id: str | None,
        tenant_id: str | None = None,
        clerk_org_id: str | None = None,
    ) -> "TenantContext":
        uid = (user_id or "anonymous").strip()
        tid = (tenant_id or f"tenant-{uid}").strip()
        return TenantContext(tenant_id=tid, user_id=uid, clerk_org_id=clerk_org_id)
