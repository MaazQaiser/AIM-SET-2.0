from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

AGENT_IDS: List[str] = [
    "live-call",
    "discovery-checklist",
    "content",
    "workflow",
    "post_dc",
    "content_generation",
]

AGENT_LABELS: Dict[str, str] = {
    "live-call": "Live Call Agent",
    "discovery-checklist": "Discovery Checklist Tracker",
    "content": "Content Agent",
    "workflow": "PRE-DC Workflow",
    "post_dc": "Post-DC Agent",
    "content_generation": "Content Generation Agent",
}

AGENT_DOMAINS: Dict[str, List[str]] = {
    "live-call": ["live_assist"],
    "discovery-checklist": ["live_assist"],
    "content": ["content_generation"],
    "workflow": ["content_generation"],
    "post_dc": ["task_execution", "coaching_insights"],
    "content_generation": ["content_generation"],
}

PROMPT_ROOT = Path(__file__).resolve().parents[4] / "prompts"

WORKFLOW_PROMPT_FILES: Dict[str, str] = {
    "summary": "workflow/summary/v1.0.0.md",
    "artifact_plan": "workflow/artifact_plan/v1.0.0.md",
    "artifact_fulfill": "workflow/artifact_fulfill/v1.0.0.md",
}

POST_DC_PROMPT_FILES: Dict[str, str] = {
    "summary": "post_dc/summary.txt",
    "email": "post_dc/email.txt",
    "coaching": "post_dc/coaching.txt",
}


def _read_prompt_body(rel_path: str) -> str:
    path = PROMPT_ROOT / rel_path
    if not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8")
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            return parts[2].strip()
    return text.strip()


def _default_workflow_prompts() -> Dict[str, str]:
    return {key: _read_prompt_body(rel) for key, rel in WORKFLOW_PROMPT_FILES.items()}


def _default_post_dc_prompts() -> Dict[str, str]:
    return {key: _read_prompt_body(rel) for key, rel in POST_DC_PROMPT_FILES.items()}

AGENT_PROMPT_GLOBS: Dict[str, List[str]] = {
    "live-call": ["live-call/**/*.md", "live-call/intent_detection/**/*.md"],
    "discovery-checklist": ["discovery-checklist/**/*.md"],
    "content": ["content/pre_dc_brief/**/*.md"],
    "workflow": ["workflow/**/*.md", "pre-dc/**/*.md"],
    "post_dc": ["post_dc/**/*.txt"],
    "content_generation": ["content/studio/**/*.md", "content/template_vision/**/*.md"],
}

AGENT_OPERATIONS: Dict[str, List[str]] = {
    "live-call": [
        "proactive_nudge",
        "signal_annotation",
        "intent_snapshot",
        "sentiment_update",
        "focus_suggestion",
    ],
    "discovery-checklist": ["checklist_updated", "discovery_nudge", "session_finalized"],
    "content": ["pre_dc_brief"],
    "workflow": ["workflow_pipeline"],
    "post_dc": ["review_produced"],
    "content_generation": ["studio_turn", "template_ingest", "export_pdf", "export_png", "export_pptx"],
}


def discover_prompt_versions(agent_id: str) -> List[Dict[str, Any]]:
    patterns = AGENT_PROMPT_GLOBS.get(agent_id, [])
    if not patterns:
        return []
    found: List[Path] = []
    for pattern in patterns:
        found.extend(sorted(PROMPT_ROOT.glob(pattern)))
    versions: List[Dict[str, Any]] = []
    for path in found:
        rel = path.relative_to(PROMPT_ROOT).as_posix()
        parts = rel.split("/")
        version = parts[-1].replace(".md", "") if parts else "1.0.0"
        label = parts[-2] if len(parts) >= 2 else agent_id
        versions.append(
            {
                "version": version,
                "label": label,
                "path": rel,
                "deployed_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
                "reviewed_by": "repo",
                "changelog": f"Prompt file in repository: {rel}",
                "is_active": len(versions) == 0,
            }
        )
    return versions


def _iso_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")


def _guardrails() -> Dict[str, Any]:
    return {
        "policy_version": "2026.05.1",
        "pre_input": {
            "execution_order": 1,
            "rules": [
                {"id": "pre-intent", "name": "Intent and risk classify", "description": "Classify request intent, risk, and policy domain before processing.", "severity": "warn", "mode": "enforce", "enabled": True},
                {"id": "pre-pii", "name": "PII and secret mask", "description": "Mask emails, tokens, and account IDs before prompt construction.", "severity": "block", "mode": "enforce", "enabled": True},
                {"id": "pre-abuse", "name": "Rate and token quota", "description": "Apply per-tenant request/token budgets and abuse controls.", "severity": "block", "mode": "enforce", "enabled": True},
            ],
        },
        "in_generation": {
            "execution_order": 2,
            "rules": [
                {"id": "gen-stream-mod", "name": "Streaming moderation", "description": "Check partial output chunks for harmful content before emission.", "severity": "block", "mode": "enforce", "enabled": True},
                {"id": "gen-tool-policy", "name": "Tool-call policy", "description": "Validate schema, destination, and risk tier for each tool call.", "severity": "block", "mode": "enforce", "enabled": True},
                {"id": "gen-stateful", "name": "Stateful constraint check", "description": "Deny disallowed operations by session state and role.", "severity": "warn", "mode": "enforce", "enabled": True},
            ],
        },
        "post_output": {
            "execution_order": 3,
            "rules": [
                {"id": "post-contract", "name": "Output contract validation", "description": "Validate final structure and required fields before send.", "severity": "block", "mode": "enforce", "enabled": True},
                {"id": "post-redaction", "name": "Leak redaction pass", "description": "Final scan and redact sensitive values before delivery.", "severity": "block", "mode": "enforce", "enabled": True},
                {"id": "post-confidence", "name": "Confidence and escalation", "description": "Tag low-confidence outputs and trigger fallback/escalation.", "severity": "warn", "mode": "enforce", "enabled": True},
            ],
        },
    }


def _workflow() -> Dict[str, Any]:
    return {
        "version": "1.0.0",
        "states": [
            "receive_input", "validate_input", "policy_check", "plan_step", "execute_tool",
            "evaluate_result", "stream_response", "final_policy_check", "deliver", "escalate_human",
        ],
        "transitions": [
            {"from": "receive_input", "to": "validate_input", "condition": "input_received"},
            {"from": "validate_input", "to": "policy_check", "condition": "payload_valid"},
            {"from": "policy_check", "to": "plan_step", "condition": "policy_pass"},
            {"from": "plan_step", "to": "execute_tool", "condition": "tool_required"},
            {"from": "execute_tool", "to": "evaluate_result", "condition": "tool_finished"},
            {"from": "evaluate_result", "to": "plan_step", "condition": "needs_additional_step"},
            {"from": "evaluate_result", "to": "stream_response", "condition": "ready_to_respond"},
            {"from": "stream_response", "to": "final_policy_check", "condition": "response_complete"},
            {"from": "final_policy_check", "to": "deliver", "condition": "final_guardrail_pass"},
            {"from": "final_policy_check", "to": "escalate_human", "condition": "final_guardrail_fail"},
            {"from": "escalate_human", "to": "deliver", "condition": "handoff_or_safe_refusal_ready"},
        ],
        "policy": {
            "max_tool_iterations": 3,
            "allow_parallel_readonly_subtasks": True,
            "require_idempotency_for_side_effects": True,
            "circuit_breaker_threshold": 4,
            "fallback_model_on_latency_spike": True,
        },
    }


def _model_policy(agent_id: str) -> Dict[str, Any]:
    if agent_id in ("content", "content_generation"):
        return {
            "primary": "mini",
            "fallback": "mini",
            "model_name": "gpt-5.4-mini",
            "fallback_model_name": "gpt-5.4-mini",
        }
    if agent_id in ("workflow", "post_dc"):
        return {
            "primary": "mini",
            "fallback": "mini",
            "model_name": "gpt-5.4-mini",
            "fallback_model_name": "gpt-5.4-mini",
        }
    if agent_id == "live-call":
        return {
            "primary": "mini",
            "fallback": "mini",
            "model_name": "gpt-5.4-mini",
            "fallback_model_name": "gpt-5.4-mini",
        }
    return {
        "primary": "haiku",
        "fallback": "sonnet",
        "model_name": "claude-3-haiku-20240307",
        "fallback_model_name": "claude-sonnet-4-20250514",
    }


def _cost_cap(agent_id: str) -> Dict[str, Any]:
    if agent_id == "content_generation":
        return {
            "per_run_ceiling_usd": 0.05,
            "project_ceiling_usd": 1.5,
            "abort_strategy": "hard_stop",
        }
    if agent_id in ("content", "workflow", "post_dc"):
        return {"per_run_ceiling_usd": 0.05, "abort_strategy": "degrade"}
    return {"per_run_ceiling_usd": 0.02, "abort_strategy": "degrade"}


def default_agent_config(agent_id: str) -> Dict[str, Any]:
    if agent_id not in AGENT_IDS:
        raise ValueError(f"Unknown agent_id: {agent_id}")

    label = AGENT_LABELS[agent_id]
    cfg: Dict[str, Any] = {
        "agent_id": agent_id,
        "system_prompt_override": "",
        "profile": {
            "profile_version": "1.0.0",
            "immutable_revision": 4,
            "identity": {
                "name": label,
                "role": f"{label} specialist",
                "allowed_domains": AGENT_DOMAINS[agent_id],
                "persona_boundaries": [
                    "Do not fabricate product commitments.",
                    "Escalate compliance or legal ambiguity to a human reviewer.",
                ],
            },
            "runtime": {
                "provider": "hybrid",
                "model_routing_policy": "balanced",
                "latency_budget_ms": 1800 if agent_id == "live-call" else 3200,
                "max_turns": 6 if agent_id == "live-call" else 10,
                "timeout_ms": 7000,
                "retry_budget": 2,
            },
            "memory": {
                "session_ttl_seconds": 3600,
                "long_term_memory_enabled": agent_id != "live-call",
                "retention_days": 30,
            },
            "tools": [
                {
                    "tool_name": "kb_search",
                    "timeout_ms": 1200,
                    "quota_per_hour": 1800,
                    "input_schema_version": "2026-05-01",
                    "side_effecting": False,
                },
                {
                    "tool_name": "analytics_query",
                    "timeout_ms": 2000,
                    "quota_per_hour": 400,
                    "input_schema_version": "2026-05-01",
                    "side_effecting": False,
                },
            ],
            "output_contract": {
                "allowed_formats": ["markdown", "json"],
                "required_fields": ["summary", "evidence"],
                "forbidden_content_classes": ["pii_leak", "secret_exposure"],
            },
            "risk_tier": "medium",
            "escalation": {
                "enabled": True,
                "max_auto_attempts": 2,
                "confidence_threshold": 0.62,
                "triggers": ["policy_violation", "low_confidence", "tool_failure"],
                "fallback_action": "handoff_human",
            },
        },
        "model_policy": _model_policy(agent_id),
        "cost_cap": _cost_cap(agent_id),
        "throttle": {
            "max_nudges_per_window": 3,
            "window_seconds": 300,
            "max_concurrent_runs": 5 if agent_id == "live-call" else 3,
        },
        "failure_behaviour": {
            "max_retries": 3,
            "retry_delay_ms": 500,
            "fallback_strategy": "degrade_gracefully",
            "alert_on_failure": True,
        },
        "guardrails": _guardrails(),
        "workflow": _workflow(),
        "observability": {
            "event_schema": {
                "required_fields": ["session_id", "agent_id", "policy_version", "risk_tier", "tool_call_id"],
                "trace_key": "trace_id",
            },
            "metrics": [
                {"id": "first_token_latency", "label": "First token latency", "target": 1200, "unit": "ms", "alert_threshold": 1800},
                {"id": "turn_latency", "label": "Turn latency", "target": 3500, "unit": "ms", "alert_threshold": 5000},
                {"id": "tool_error_rate", "label": "Tool error rate", "target": 2, "unit": "%", "alert_threshold": 5},
                {"id": "guardrail_hit_rate", "label": "Guardrail hit rate", "target": 8, "unit": "%", "alert_threshold": 15},
                {"id": "escalation_rate", "label": "Escalation rate", "target": 5, "unit": "%", "alert_threshold": 10},
            ],
            "tracing_enabled": True,
            "audit": {"immutable_log": True, "retention_days": 365, "replay_harness_enabled": True},
        },
        "rollout": {
            "current_stage": "shadow",
            "stages": [
                {"stage": "simulation", "enabled": True, "gate": "Historical replay accuracy >= 95%"},
                {"stage": "shadow", "enabled": True, "gate": "No Sev-1 policy misses for 7 days"},
                {"stage": "soft_enforcement", "enabled": False, "gate": "False positive rate < 2%"},
                {"stage": "high_risk_first", "enabled": False, "gate": "High-risk flows fully instrumented"},
                {"stage": "continuous_tuning", "enabled": False, "gate": "Weekly drift review automation active"},
            ],
        },
        "active_prompt_versions": discover_prompt_versions(agent_id),
        "operations": AGENT_OPERATIONS.get(agent_id, []),
    }

    if agent_id == "discovery-checklist":
        from dc_tools.bant import DEFAULT_PLAYBOOK, SECONDARY_ITEM_IDS

        cfg["checklist_policy"] = {
            "nudge_thresholds_seconds": {
                "budget": 1800,
                "authority": 1200,
                "need": 900,
                "timeline": 1500,
                "next_step": 2400,
            },
            "enabled_secondary_items": list(SECONDARY_ITEM_IDS),
            "playbook": DEFAULT_PLAYBOOK,
        }

    if agent_id == "workflow":
        cfg["workflow_prompts"] = _default_workflow_prompts()
        cfg["summary_highlight_rules"] = [
            {
                "pattern": r"\b(budget|revenue|pricing|cost|ROI|\$[\d,.]+[KMB]?)\b",
                "className": "rounded px-1 py-0.5 bg-amber-100/90 text-amber-950",
                "flags": "gi",
            },
            {
                "pattern": r"\b(timeline|deadline|Q[1-4]|within \d+ (?:days|weeks|months))\b",
                "className": "rounded px-1 py-0.5 bg-blue-100/90 text-blue-950",
                "flags": "gi",
            },
            {
                "pattern": r"\b(pain|challenge|struggle|bottleneck|legacy)\b",
                "className": "rounded px-1 py-0.5 bg-orange-100/90 text-orange-950",
                "flags": "gi",
            },
            {
                "pattern": r"\b(competitor|alternative|vendor|switching|incumbent)\b",
                "className": "rounded px-1 py-0.5 bg-rose-100/90 text-rose-950",
                "flags": "gi",
            },
            {
                "pattern": r"\b(opportunity|growth|scale|expansion|priority|strategic|initiative)\b",
                "className": "rounded px-1 py-0.5 bg-emerald-100/90 text-emerald-950",
                "flags": "gi",
            },
            {
                "pattern": r"\b(authority|decision|stakeholder|executive|CTO|CFO|VP|director|buyer)\b",
                "className": "rounded px-1 py-0.5 bg-violet-100/90 text-violet-950",
                "flags": "gi",
            },
        ]

    if agent_id == "post_dc":
        cfg["post_dc_prompts"] = _default_post_dc_prompts()
        cfg["jira"] = {
            "project_key": "SALES",
            "issue_type": "Review",
            "high_priority_threshold_usd": 250000,
        }

    if agent_id == "live-call":
        cfg["signal_routing"] = [
            {"id": "sr-1", "keyword_pattern": "competitor|alternative|vs\\s|compared to", "signal_type": "competitor_mentioned", "nudge_type": "objection_handler", "target_role": "AE", "enabled": True, "confidence_threshold": 0.75},
            {"id": "sr-2", "keyword_pattern": "budget|cost|price|pricing|invoice|spend", "signal_type": "budget_signal", "nudge_type": "discovery_question", "target_role": "AE", "enabled": True, "confidence_threshold": 0.70},
            {"id": "sr-3", "keyword_pattern": "integration|API|technical|architecture|stack", "signal_type": "technical_question", "nudge_type": "reference_asset", "target_role": "SE", "enabled": True, "confidence_threshold": 0.65},
            {"id": "sr-4", "keyword_pattern": "timeline|eta|estimated delivery|delivery date|completion date|deadline|launch|go-live|kickoff|rollout|pilot|urgent|q[1-4]", "signal_type": "timeline_signal", "nudge_type": "discovery_question", "target_role": "AE", "enabled": True, "confidence_threshold": 0.70},
            {"id": "sr-5", "keyword_pattern": "design|mockup|prototype|UX|demo", "signal_type": "design_query", "nudge_type": "reference_asset", "target_role": "Designer", "enabled": False, "confidence_threshold": 0.60},
        ]

    return cfg


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = deepcopy(base)
    for key, val in override.items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], val)
        else:
            out[key] = val
    return out


EDITABLE_CONFIG_KEYS = frozenset(
    {
        "system_prompt_override",
        "workflow_prompts",
        "post_dc_prompts",
        "pre_dc_prompts",
        "summary_highlight_rules",
        "model_policy",
        "cost_cap",
        "throttle",
        "signal_routing",
        "failure_behaviour",
        "jira",
    }
)


def merge_agent_config(agent_id: str, saved: Dict[str, Any] | None) -> Dict[str, Any]:
    base = default_agent_config(agent_id)
    if not saved:
        return base
    saved = dict(saved)
    if agent_id == "workflow" and "workflow_prompts" not in saved and saved.get("pre_dc_prompts"):
        saved["workflow_prompts"] = saved["pre_dc_prompts"]
    patch = {k: saved[k] for k in EDITABLE_CONFIG_KEYS if k in saved}
    merged = deep_merge(base, patch)
    if agent_id == "workflow":
        merged = _apply_workflow_config_defaults(merged, base)
    if agent_id == "post_dc":
        merged = _apply_post_dc_config_defaults(merged, base)
    merged["agent_id"] = agent_id
    merged["active_prompt_versions"] = discover_prompt_versions(agent_id)
    merged["operations"] = AGENT_OPERATIONS.get(agent_id, [])
    return merged


def _apply_workflow_config_defaults(merged: Dict[str, Any], base: Dict[str, Any]) -> Dict[str, Any]:
    """Empty saved overrides mean 'use repo defaults' — do not wipe prompts or highlight rules."""
    base_prompts = base.get("workflow_prompts") or _default_workflow_prompts()
    merged_prompts = dict(merged.get("workflow_prompts") or {})
    for key, default_text in base_prompts.items():
        if not str(merged_prompts.get(key) or "").strip():
            merged_prompts[key] = default_text
    merged["workflow_prompts"] = merged_prompts

    rules = merged.get("summary_highlight_rules")
    if not isinstance(rules, list) or len(rules) == 0:
        merged["summary_highlight_rules"] = list(base.get("summary_highlight_rules") or [])
    return merged


def _apply_post_dc_config_defaults(merged: Dict[str, Any], base: Dict[str, Any]) -> Dict[str, Any]:
    base_prompts = base.get("post_dc_prompts") or _default_post_dc_prompts()
    merged_prompts = dict(merged.get("post_dc_prompts") or {})
    for key, default_text in base_prompts.items():
        if not str(merged_prompts.get(key) or "").strip():
            merged_prompts[key] = default_text
    merged["post_dc_prompts"] = merged_prompts
    return merged
