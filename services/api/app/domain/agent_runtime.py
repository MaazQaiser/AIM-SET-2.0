from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from dc_core.tenancy import TenantContext

from app.domain.agent_config_repository import get_agent_config_repository

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"


def load_prompt_file(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "You are a helpful agent."


def _active_prompt_entry(config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    versions = config.get("active_prompt_versions") or []
    for item in versions:
        if item.get("is_active"):
            return item
    return versions[0] if versions else None


def resolve_prompt_path(config: Dict[str, Any]) -> str:
    active = _active_prompt_entry(config)
    if active and active.get("path"):
        return str(active["path"])
    return "content/studio/v1.0.0.md"


def get_effective_agent_config(ctx: TenantContext, agent_id: str) -> Dict[str, Any]:
    return get_agent_config_repository().get_config(ctx, agent_id)


def get_content_generation_runtime(ctx: TenantContext) -> Dict[str, Any]:
    cfg = get_effective_agent_config(ctx, "content_generation")
    model_policy = cfg.get("model_policy") or {}
    cost_cap = cfg.get("cost_cap") or {}
    override = (cfg.get("system_prompt_override") or "").strip()
    prompt_path = resolve_prompt_path(cfg)

    return {
        "model_name": model_policy.get("model_name") or "claude-opus-4-7",
        "fallback_model_name": model_policy.get("fallback_model_name") or "claude-sonnet-4-6",
        "per_run_ceiling_usd": float(cost_cap.get("per_run_ceiling_usd") or 0.05),
        "project_ceiling_usd": float(cost_cap.get("project_ceiling_usd") or 1.5),
        "abort_strategy": cost_cap.get("abort_strategy") or "hard_stop",
        "system_prompt": override or load_prompt_file(prompt_path),
        "prompt_path": prompt_path,
        "config": cfg,
    }
