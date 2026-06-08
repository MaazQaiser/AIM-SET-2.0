from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.agent_config_defaults import AGENT_IDS, EDITABLE_CONFIG_KEYS, merge_agent_config
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from app.deps import get_supabase
_logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tenant_keys(ctx: TenantContext) -> tuple[str, str]:
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    return tenant_uuid, clerk_key


def _fallback_clerk_key(ctx: TenantContext) -> str:
    return ctx.clerk_org_id or ctx.tenant_id or ctx.user_id or "local-dev"


class AgentConfigRepository:
    def get_config(self, ctx: TenantContext, agent_id: str) -> Dict[str, Any]:
        if agent_id not in AGENT_IDS:
            raise ValueError(f"Unknown agent_id: {agent_id}")

        tenant_uuid: Optional[str] = None
        try:
            tenant_uuid, clerk_key = _tenant_keys(ctx)
        except Exception:
            clerk_key = _fallback_clerk_key(ctx)
            _logger.exception(
                "tenant resolution failed for agent config; using default config agent_id=%s tenant_key=%s",
                agent_id,
                clerk_key,
            )
        store = get_memory_store()
        saved: Optional[Dict[str, Any]] = store.agent_configs.get(clerk_key, {}).get(agent_id)
        if saved is None and agent_id == "workflow":
            saved = store.agent_configs.get(clerk_key, {}).get("pre-dc")

        if saved is None:
            settings = get_settings()
            if settings.supabase_configured and tenant_uuid:
                def _fetch(fetch_agent_id: str) -> Optional[Dict[str, Any]]:
                    row = (
                        get_supabase()
                        .table("agent_configs")
                        .select("config")
                        .eq("tenant_id", tenant_uuid)
                        .eq("agent_id", fetch_agent_id)
                        .limit(1)
                        .execute()
                    )
                    data = (row.data or [None])[0]
                    if data and isinstance(data.get("config"), dict):
                        return data["config"]
                    return None

                try:
                    saved = _fetch(agent_id)
                except Exception:
                    saved = None
                if saved is None and agent_id == "workflow":
                    try:
                        saved = _fetch("pre-dc")
                    except Exception:
                        saved = None

        return merge_agent_config(agent_id, saved)

    def save_config(self, ctx: TenantContext, agent_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        if agent_id not in AGENT_IDS:
            raise ValueError(f"Unknown agent_id: {agent_id}")

        tenant_uuid, clerk_key = _tenant_keys(ctx)
        settings = get_settings()
        payload = {k: config[k] for k in EDITABLE_CONFIG_KEYS if k in config}
        payload["agent_id"] = agent_id
        row = {
            "tenant_id": tenant_uuid,
            "agent_id": agent_id,
            "config": payload,
            "updated_by": ctx.user_id,
            "updated_at": _now_iso(),
        }

        if settings.supabase_configured:
            def _upsert() -> None:
                get_supabase().table("agent_configs").upsert(row, on_conflict="tenant_id,agent_id").execute()

            try:
                _upsert()
            except Exception:
                _logger.exception("failed to upsert agent config agent_id=%s", agent_id)

        store = get_memory_store()
        store.agent_configs.setdefault(clerk_key, {})[agent_id] = payload

        audit = {
            "id": f"audit-{agent_id}-{int(datetime.now(timezone.utc).timestamp())}",
            "agent_id": agent_id,
            "event_type": "config_updated",
            "message": f"Agent configuration updated for {agent_id}",
            "created_at": _now_iso(),
        }
        store.add_audit(clerk_key, audit)

        return merge_agent_config(agent_id, payload)


_repo: Optional[AgentConfigRepository] = None


def get_agent_config_repository() -> AgentConfigRepository:
    global _repo
    if _repo is None:
        _repo = AgentConfigRepository()
    return _repo
