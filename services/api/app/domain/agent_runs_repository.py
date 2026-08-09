from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from app.deps import get_supabase


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _payload_tokens(row: Dict[str, Any]) -> tuple[Optional[int], Optional[int]]:
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    tokens_in = row.get("tokens_in", payload.get("tokens_in") if payload else None)
    tokens_out = row.get("tokens_out", payload.get("tokens_out") if payload else None)
    try:
        tin = int(tokens_in) if tokens_in is not None else None
    except (TypeError, ValueError):
        tin = None
    try:
        tout = int(tokens_out) if tokens_out is not None else None
    except (TypeError, ValueError):
        tout = None
    return tin, tout


def _normalize_run(row: Dict[str, Any]) -> Dict[str, Any]:
    tokens_in, tokens_out = _payload_tokens(row)
    out: Dict[str, Any] = {
        "id": str(row.get("id", "")),
        "agent_id": row.get("agent_id", ""),
        "operation": row.get("operation", ""),
        "trace_id": row.get("trace_id", ""),
        "status": row.get("status", "success"),
        "cost_usd": float(row.get("cost_usd") or 0),
        "tokens_used": int(row.get("tokens_used") or 0),
        "model_used": row.get("model_used") or "",
        "created_at": row.get("created_at") or _now_iso(),
    }
    if tokens_in is not None:
        out["tokens_in"] = tokens_in
    if tokens_out is not None:
        out["tokens_out"] = tokens_out
    return out


class AgentRunsRepository:
    def list_runs(self, ctx: TenantContext, *, limit: int = 200) -> List[Dict[str, Any]]:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        by_id: Dict[str, Dict[str, Any]] = {}

        settings = get_settings()
        if settings.supabase_configured:
            try:
                res = (
                    get_supabase()
                    .table("agent_runs")
                    .select("*")
                    .eq("tenant_id", tenant_uuid)
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                for row in res.data or []:
                    norm = _normalize_run(row)
                    if norm["id"]:
                        by_id[norm["id"]] = norm
            except Exception:
                pass

        for row in get_memory_store().agent_runs.get(clerk_key, []):
            norm = _normalize_run(row)
            rid = norm["id"] or f"mem-{norm['trace_id']}-{norm['operation']}"
            norm["id"] = rid
            if rid not in by_id:
                by_id[rid] = norm

        runs = list(by_id.values())
        runs.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return runs[:limit]

    def append_run(
        self,
        ctx: TenantContext,
        *,
        agent_id: str,
        operation: str,
        trace_id: str,
        cost_usd: float = 0.0,
        tokens_used: int = 0,
        tokens_in: Optional[int] = None,
        tokens_out: Optional[int] = None,
        model_used: str = "",
        status: str = "success",
        run_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        import uuid

        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        run_id = run_id or str(uuid.uuid4())
        created_at = _now_iso()
        payload: Dict[str, Any] = {}
        if tokens_in is not None:
            payload["tokens_in"] = int(tokens_in)
        if tokens_out is not None:
            payload["tokens_out"] = int(tokens_out)

        run: Dict[str, Any] = {
            "id": run_id,
            "agent_id": agent_id,
            "operation": operation,
            "trace_id": trace_id,
            "status": status,
            "cost_usd": float(cost_usd),
            "tokens_used": int(tokens_used),
            "model_used": model_used or "",
            "created_at": created_at,
            "payload": payload,
        }
        if tokens_in is not None:
            run["tokens_in"] = int(tokens_in)
        if tokens_out is not None:
            run["tokens_out"] = int(tokens_out)

        get_memory_store().add_agent_run(clerk_key, run)

        settings = get_settings()
        if settings.supabase_configured:
            try:
                get_supabase().table("agent_runs").insert(
                    {
                        "id": run_id,
                        "tenant_id": tenant_uuid,
                        "agent_id": agent_id,
                        "operation": operation,
                        "trace_id": trace_id,
                        "status": status,
                        "cost_usd": run["cost_usd"],
                        "tokens_used": run["tokens_used"],
                        "model_used": run["model_used"],
                        "payload": payload,
                        "created_at": created_at,
                    }
                ).execute()
            except Exception:
                pass

        return run


_repo: Optional[AgentRunsRepository] = None


def get_agent_runs_repository() -> AgentRunsRepository:
    global _repo
    if _repo is None:
        _repo = AgentRunsRepository()
    return _repo
