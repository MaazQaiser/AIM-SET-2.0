from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.config import get_settings
from app.domain.agent_config_repository import get_agent_config_repository

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"


def load_prompt(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return (
        "You are the DC Copilot daily briefing assistant. "
        "Write one actionable paragraph for the AE morning dashboard."
    )


def _fallback_paragraph(context: Dict[str, Any]) -> str:
    todays = int(context.get("todaysCallCount") or 0)
    pending = int(context.get("pendingApprovalCount") or 0)
    briefs_not_ready = int(context.get("briefsNotReady") or 0)
    top = context.get("topOpportunity") or {}
    account = top.get("accountName") or "your pipeline"
    revenue = top.get("annualRevenue")
    lead = top.get("leadName")

    if todays == 0:
        return (
            "No discovery calls on the calendar today. Use the time to clear pending "
            "approvals, review coaching insights, or prep for upcoming meetings in the week view."
        )
    if top:
        paragraph = f"Your highest-value touchpoint today is {account}"
        if revenue:
            paragraph += f" ({revenue})"
        paragraph += ". "
        if lead:
            paragraph += (
                f"{lead} is on the invite — anchor discovery on their stated pains "
                "before pricing enters the room. "
            )
        if pending > 0:
            paragraph += (
                f"You have {pending} post-call item{'s' if pending > 1 else ''} waiting for "
                "approval — clearing those before your first call keeps follow-ups on track."
            )
        elif briefs_not_ready > 0:
            paragraph += (
                f"{briefs_not_ready} brief{'s are' if briefs_not_ready > 1 else ' is'} still "
                "generating; open each pre-DC view once the Content Agent finishes."
            )
        else:
            paragraph += (
                "All briefs are ready — skim the AI summary on each call page before you join."
            )
        return paragraph
    return (
        f"You have {todays} call{'s' if todays > 1 else ''} today. Prioritise prep on accounts "
        "with the strongest revenue signal and confirm pod coverage for technical depth."
    )


def run_daily_briefing(
    ctx: TenantContext,
    *,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a daily briefing paragraph; falls back to template when LLM unavailable."""
    settings = get_settings()
    fallback = _fallback_paragraph(context)
    api_key = settings.llm_api_key or None
    if not api_key:
        return {
            "paragraph": fallback,
            "source": "template",
            "model": None,
        }

    try:
        cfg = get_agent_config_repository().get_config(ctx, "workflow")
    except Exception:
        cfg = {}
    model_policy = cfg.get("model_policy") or {}
    system = load_prompt("dashboard/daily_briefing/v1.0.0.md")
    user = json.dumps(context, indent=2, default=str)

    try:
        completion = LlmClient(api_key=api_key).complete(
            system=system,
            user=user,
            model=model_policy.get("model_name") or "claude-sonnet-4-20250514",
            fallback_model=model_policy.get("fallback_model_name") or "claude-haiku-4-5-20251001",
            max_tokens=400,
        )
        text = (completion.text or "").strip()
        model_name = completion.model or model_policy.get("model_name")
        if not text or model_name == "fallback-local":
            return {"paragraph": fallback, "source": "template", "model": None}
        return {
            "paragraph": text,
            "source": "llm",
            "model": model_name,
        }
    except Exception:
        return {"paragraph": fallback, "source": "template", "model": None}
