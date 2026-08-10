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
    pending = int(
        context.get("pendingPostDcActionCount")
        or context.get("pendingApprovalCount")
        or 0
    )
    briefs_not_ready = int(context.get("briefsNotReady") or 0)
    completed = int(context.get("completedCallCount") or 0)
    prep_pending = int(context.get("pendingPrepItemCount") or 0)
    priority_calls = context.get("priorityCalls") or []
    material_types = context.get("recommendedMaterialTypes") or []
    top = priority_calls[0] if priority_calls else context.get("topOpportunity") or {}
    account = top.get("accountName") or "your calendar"
    lead = top.get("leadName")
    agent_rating = top.get("agentRating")
    prep_line = (
        f"Overall, {prep_pending} prep item{'s are' if prep_pending != 1 else ' is'} "
        "still pending creation."
        if prep_pending > 0
        else "Overall, no prep items are pending creation."
    )

    if todays == 0:
        return (
            "No calls are scheduled for today. Use the window to clear post-DC actions, "
            "review completed discovery notes, and create pending materials. "
            f"{prep_line}"
        )
    if top:
        names = [
            call.get("accountName")
            for call in priority_calls[:2]
            if call.get("accountName")
        ] or [account]
        if len(names) == 1:
            focus = names[0]
        else:
            focus = f"{names[0]} and {names[1]}"
        paragraph = (
            f"You have {todays} call{'s' if todays != 1 else ''} today. "
            f"Prioritize {focus}"
        )
        if isinstance(agent_rating, int) and agent_rating >= 7:
            paragraph += f" because {account} carries an agent rating of {agent_rating}. "
        elif lead:
            paragraph += (
                f" because {lead} is attached as the buyer contact and discovery prep should "
                "anchor on their stated needs. "
            )
        else:
            paragraph += " because it has the clearest prep signal on today's calendar. "
        if pending > 0:
            action_types = context.get("postDcActionTypes") or []
            action_hint = _post_dc_action_hint(action_types)
            paragraph += (
                f"From completed discovery calls, {pending} post-DC action"
                f"{'s are' if pending != 1 else ' is'} pending: {action_hint}. "
            )
        elif completed > 0:
            paragraph += "From completed discovery calls, no post-DC actions are pending right now. "
        else:
            paragraph += "No completed discovery calls need post-DC follow-up yet. "

        if material_types:
            paragraph += (
                "AI recommends "
                f"{_join_list(material_types[:2])} for your priority calls. "
            )
        elif briefs_not_ready > 0:
            paragraph += (
                f"{briefs_not_ready} brief{'s are' if briefs_not_ready > 1 else ' is'} still "
                "generating; open each pre-DC view once the Content Agent finishes. "
            )
        else:
            paragraph += "AI has no new material recommendation for priority calls. "
        paragraph += prep_line
        return paragraph
    return (
        f"You have {todays} call{'s' if todays != 1 else ''} today. Prioritize the "
        f"next scheduled account and check whether any post-DC follow-up is waiting. {prep_line}"
    )


def _join_list(items: List[str]) -> str:
    clean = [str(item).strip() for item in items if str(item).strip()]
    if not clean:
        return "recommended material"
    if len(clean) == 1:
        return clean[0]
    return f"{clean[0]} and {clean[1]}"


def _post_dc_action_hint(action_types: List[str]) -> str:
    labels = []
    for action_type in action_types:
        if action_type == "follow_up":
            labels.append("send follow-up")
        elif action_type == "content_request":
            labels.append("send requested material")
        elif action_type == "schedule_next_meeting":
            labels.append("schedule next meeting")
        elif action_type == "internal_review":
            labels.append("complete internal review")

    return _join_list(labels[:3]) if labels else "confirm next steps"


def run_daily_briefing(
    ctx: TenantContext,
    *,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a daily briefing paragraph; falls back to template when LLM unavailable."""
    settings = get_settings()
    fallback = _fallback_paragraph(context)
    if not settings.openai_configured:
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
        completion = LlmClient(openai_api_key=settings.openai_api_key or None).complete(
            system=system,
            user=user,
            model=model_policy.get("model_name") or "gpt-5.4-mini",
            fallback_model=model_policy.get("fallback_model_name") or "gpt-5.4-mini",
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
