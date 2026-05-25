from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.config import get_settings
from app.domain.agent_config_repository import get_agent_config_repository
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"

BANT_LABELS = {
    "budget": "Budget",
    "authority": "Authority",
    "need": "Need",
    "timeline": "Timeline",
    "next_step": "Next step",
}


def load_prompt(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def resolve_prompt(cfg: Dict[str, Any], operation: str, default_path: str) -> str:
    overrides = cfg.get("post_dc_prompts") or {}
    custom = (overrides.get(operation) or "").strip()
    if custom:
        return custom
    file_text = load_prompt(default_path)
    return file_text or f"You are the Post-DC Agent ({operation})."


def _extract_json_block(text: str) -> Optional[Dict[str, Any]]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _snapshot_result(snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not snapshot:
        return {}
    result = snapshot.get("result")
    return result if isinstance(result, dict) else snapshot


def _open_gaps(discovery_snapshot: Optional[Dict[str, Any]]) -> List[str]:
    result = _snapshot_result(discovery_snapshot)
    gaps = result.get("openGaps") or []
    return [str(g) for g in gaps if str(g).strip()]


def _bant_coverage(discovery_snapshot: Optional[Dict[str, Any]]) -> Optional[float]:
    result = _snapshot_result(discovery_snapshot)
    checklist = result.get("checklist") if isinstance(result.get("checklist"), dict) else {}
    value = checklist.get("bantCoverage") if checklist else result.get("bantCoverage")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _bant_progression(discovery_snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    result = _snapshot_result(discovery_snapshot)
    progression = result.get("bantProgression")
    return progression if isinstance(progression, dict) else {}


def _post_field(post_dc_record: Optional[Dict[str, Any]], key: str) -> str:
    fields = (post_dc_record or {}).get("fields") or {}
    return str(fields.get(key) or "").strip()


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _account_name(call: Optional[Dict[str, Any]], pre_dc_fields: Optional[Dict[str, str]], call_id: str) -> str:
    return _first_text(
        (call or {}).get("accountName"),
        (pre_dc_fields or {}).get("Company Name-PreDC"),
        call_id,
    )


def _extract_recipients(call: Optional[Dict[str, Any]], pre_dc_fields: Optional[Dict[str, str]]) -> List[str]:
    candidates = [
        (call or {}).get("leadEmail"),
        (call or {}).get("email"),
        (pre_dc_fields or {}).get("Lead Email-PreDC"),
        (pre_dc_fields or {}).get("Lead Email"),
        (pre_dc_fields or {}).get("Email-PreDC"),
        (pre_dc_fields or {}).get("Email"),
        (pre_dc_fields or {}).get("Contact Email"),
    ]
    out: List[str] = []
    for candidate in candidates:
        for piece in re.split(r"[,;]", str(candidate or "")):
            email = piece.strip()
            if email and "@" in email and email not in out:
                out.append(email)
    return out


def _transcript_excerpt(transcript_events: Optional[List[Dict[str, Any]]]) -> str:
    events = transcript_events or []
    lines: List[str] = []
    for event in events[-12:]:
        text = str(event.get("text") or "").strip()
        if not text:
            continue
        speaker = str(event.get("speaker_name") or event.get("speaker_id") or "Speaker")
        lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


def _commitments_from_text(text: str) -> List[str]:
    commitments: List[str] = []
    for raw in re.split(r"(?<=[.!?])\s+", text):
        sentence = raw.strip()
        if not sentence:
            continue
        lower = sentence.lower()
        if any(token in lower for token in ("follow up", "send", "share", "schedule", "circle back", "next step")):
            cleaned = sentence[:220]
            if cleaned not in commitments:
                commitments.append(cleaned)
    return commitments[:5]


def _commitments(
    transcript_events: Optional[List[Dict[str, Any]]],
    live_snapshot: Optional[Dict[str, Any]],
    summary_json: Optional[Dict[str, Any]] = None,
) -> List[str]:
    from_llm = (summary_json or {}).get("commitments") or []
    commitments = [str(c).strip() for c in from_llm if str(c).strip()]
    text = _transcript_excerpt(transcript_events)
    commitments.extend(_commitments_from_text(text))
    focus = (live_snapshot or {}).get("focus_areas") or []
    for item in focus:
        label = str(item).strip()
        if label:
            commitments.append(f"Follow up on {label}.")
    seen: List[str] = []
    for item in commitments:
        if item and item not in seen:
            seen.append(item)
    return seen[:5]


def _kb_search(ctx: TenantContext, query: str, limit: int = 4) -> Tuple[List[Dict[str, Any]], str]:
    settings = get_settings()
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    memory_key = clerk_key

    def vector_search(tid: str, embedding: List[float], lim: int) -> List[Dict[str, Any]]:
        return repo.match_chunks(tenant_uuid, embedding, limit=lim, clerk_key=memory_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=get_memory_store().kb_chunks.get(memory_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )
    return hits, memory_key


def _summary_fallback(
    account_name: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]],
    live_snapshot: Optional[Dict[str, Any]],
    pre_dc_fields: Optional[Dict[str, str]],
    post_dc_record: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    gaps = _open_gaps(discovery_snapshot)
    coverage = _bant_coverage(discovery_snapshot)
    progression = _bant_progression(discovery_snapshot)
    is_qualifying = bool(progression.get("isQualifying"))
    intent = (live_snapshot or {}).get("intent") or {}
    focus_areas = (live_snapshot or {}).get("focus_areas") or []
    needs = _first_text(
        (pre_dc_fields or {}).get("Have they described their needs"),
        _post_field(post_dc_record, "Need"),
        (pre_dc_fields or {}).get("Intersection areas b/w tkxel & company"),
    )
    lead_stage = _post_field(post_dc_record, "Lead Stage")
    bottom_line = _post_field(post_dc_record, "Bottom Line Context")

    if is_qualifying:
        headline = f"{account_name} looks qualified for a structured follow-up."
    elif gaps:
        headline = f"{account_name} needs follow-up on {', '.join(BANT_LABELS.get(g, g) for g in gaps[:2])}."
    else:
        headline = f"{account_name} post-call review is ready."

    summary = [
        bottom_line or needs or f"The call centered on discovery for {account_name}.",
        f"BANT coverage finished at {round((coverage or 0) * 100)}%."
        if coverage is not None
        else "BANT coverage was captured from the discovery checklist.",
    ]
    if lead_stage:
        summary.append(f"Post-DC lead stage: {lead_stage}.")
    if intent.get("label"):
        summary.append(f"Dominant live-call intent: {intent.get('label')}.")
    if focus_areas:
        summary.append("Focus areas: " + ", ".join(str(f) for f in focus_areas[:3]) + ".")
    if gaps:
        summary.append("Open discovery gaps: " + ", ".join(BANT_LABELS.get(g, g) for g in gaps) + ".")

    return {
        "headline": headline,
        "summary": summary[:5],
        "commitments": [],
        "nextStepProposal": "Schedule a focused follow-up with decision stakeholders."
        if is_qualifying
        else "Clarify the remaining discovery gaps before advancing the deal.",
    }


def _learned(discovery_snapshot: Optional[Dict[str, Any]], post_dc_record: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    progression = _bant_progression(discovery_snapshot)
    before = progression.get("before") if isinstance(progression.get("before"), dict) else {}
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    out: List[Dict[str, Any]] = []
    for dim in ("budget", "authority", "need", "timeline"):
        label = BANT_LABELS[dim]
        post_note = _post_field(post_dc_record, label)
        before_status = before.get(dim)
        after_status = after.get(dim)
        if before_status or after_status:
            note = f"{label} moved from {before_status or 'unknown'} to {after_status or 'unknown'}."
            if post_note:
                note = f"{note} Post-DC note: {post_note}"
            out.append({"label": label, "note": note})
        elif post_note:
            out.append({"label": label, "note": post_note})
    return out


def _scorecard_fallback(
    discovery_snapshot: Optional[Dict[str, Any]],
    live_snapshot: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    gaps = _open_gaps(discovery_snapshot)
    coverage = _bant_coverage(discovery_snapshot)
    customer_sentiment = (live_snapshot or {}).get("sentiment_customer")
    score = 0.7
    if coverage is not None:
        score = max(0.55, min(0.92, 0.55 + coverage * 0.35))
    if isinstance(customer_sentiment, (int, float)) and customer_sentiment > 0.25:
        score = min(0.95, score + 0.05)
    label = "strong" if score >= 0.8 else "review" if score >= 0.7 else "needs follow-up"
    watch = "Clarify remaining gaps: " + ", ".join(BANT_LABELS.get(g, g) for g in gaps) + "." if gaps else "Confirm next-step ownership."
    return [
        {
            "member": "Pod",
            "role": "Pod",
            "score": round(score, 2),
            "label": label,
            "strengths": "Discovery captured enough signal to prepare follow-up artifacts.",
            "watch": watch,
        }
    ]


def _email_fallback(
    account_name: str,
    recipients: List[str],
    summary: Dict[str, Any],
    commitments: List[str],
    gaps: List[str],
) -> Dict[str, Any]:
    next_step = summary.get("nextStepProposal") or "I will follow up with next steps."
    bullets = summary.get("summary") or []
    body_lines = [
        "Hi,",
        "",
        "Thank you for the time today. I appreciated the discussion and the context your team shared.",
    ]
    if bullets:
        body_lines.append("")
        body_lines.append("A few takeaways I captured:")
        body_lines.extend(f"- {str(item).rstrip('.')}" for item in bullets[:4])
    if commitments:
        body_lines.append("")
        body_lines.append("I will follow up on:")
        body_lines.extend(f"- {item}" for item in commitments[:4])
    if gaps:
        body_lines.append("")
        body_lines.append(
            "To keep the next step focused, I would like to clarify: "
            + ", ".join(BANT_LABELS.get(g, g).lower() for g in gaps)
            + "."
        )
    body_lines.extend(["", next_step, "", "Best,"])
    return {
        "id": f"email-{call_safe_id(account_name)}",
        "to": recipients,
        "cc": [],
        "subject": f"Follow-up from our {account_name} discovery call",
        "body_markdown": "\n".join(body_lines),
        "style_signals": ["concise", "consultative", "action-oriented"],
        "commitments_referenced": commitments,
        "status": "draft_pending_approval",
    }


def _email_attachments(
    call_brief: Optional[Dict[str, Any]],
    hits: List[Dict[str, Any]],
    *,
    account_name: str,
) -> Dict[str, List[Dict[str, Any]]]:
    plan = (call_brief or {}).get("artifactPlan") or []
    found: List[Dict[str, Any]] = []
    missing: List[Dict[str, Any]] = []
    used_assets: set[str] = set()
    for i, item in enumerate(plan[:5]):
        name = str(item.get("name") or item.get("type") or f"Follow-up asset {i + 1}")
        best = next(
            (
                hit
                for hit in hits
                if str(hit.get("asset_id") or "") not in used_assets
                and float(hit.get("score", 0) or 0) >= 0.5
            ),
            None,
        )
        if best:
            asset_id = str(best.get("asset_id") or f"asset-{i + 1}")
            used_assets.add(asset_id)
            found.append(
                {
                    "name": name,
                    "assetId": asset_id,
                    "snippet": (best.get("chunk_text") or "")[:240],
                    "downloadUrl": f"/api/kb/assets/{asset_id}/file",
                }
            )
        else:
            artifact_type = str(item.get("type") or "one_pager")
            missing.append(
                {
                    "name": name,
                    "requiredData": str(item.get("rationale") or f"Create or tag a {artifact_type} for this follow-up."),
                    "contentStudioLink": (
                        f"/content/studio?template={quote(artifact_type)}"
                        f"&account={quote(account_name)}&source=post-dc"
                    ),
                }
            )
    if not plan and hits:
        for hit in hits[:3]:
            asset_id = str(hit.get("asset_id") or "")
            if not asset_id:
                continue
            found.append(
                {
                    "name": str((hit.get("metadata") or {}).get("title") or "Relevant KB asset"),
                    "assetId": asset_id,
                    "snippet": (hit.get("chunk_text") or "")[:240],
                    "downloadUrl": f"/api/kb/assets/{asset_id}/file",
                }
            )
    return {"found": found, "missing": missing}


def call_safe_id(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "post-call"


def _crm_tasks(
    call_id: str,
    account_name: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]],
    commitments: List[str],
) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    progression = _bant_progression(discovery_snapshot)
    is_qualifying = bool(progression.get("isQualifying"))
    tasks: List[Dict[str, Any]] = [
        {
            "id": f"task-{call_id}-follow-up",
            "crm_system": "hubspot",
            "task_type": "follow_up",
            "owner": "AE",
            "due_date": (now + timedelta(days=1)).isoformat(),
            "description": f"Review and send the follow-up email draft for {account_name}.",
            "status": "pending_approval",
            "isInternalAuto": False,
        },
        {
            "id": f"task-{call_id}-debrief",
            "crm_system": "hubspot",
            "task_type": "internal_review",
            "owner": "Pod",
            "due_date": (now + timedelta(days=2)).isoformat(),
            "description": "Run a short internal debrief and confirm owners for next steps.",
            "status": "pending_approval",
            "isInternalAuto": True,
        },
    ]
    for gap in _open_gaps(discovery_snapshot):
        label = BANT_LABELS.get(gap, gap.replace("_", " ").title())
        tasks.append(
            {
                "id": f"task-{call_id}-gap-{gap}",
                "crm_system": "hubspot",
                "task_type": "internal_review",
                "owner": "AE",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": f"Clarify the open discovery gap: {label}.",
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    for i, commitment in enumerate(commitments[:3]):
        tasks.append(
            {
                "id": f"task-{call_id}-commitment-{i + 1}",
                "crm_system": "hubspot",
                "task_type": "follow_up",
                "owner": "AE",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": commitment,
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    if is_qualifying:
        tasks.append(
            {
                "id": f"task-{call_id}-next-meeting",
                "crm_system": "hubspot",
                "task_type": "schedule_next_meeting",
                "owner": "AE",
                "due_date": (now + timedelta(days=3)).isoformat(),
                "description": "Schedule the next meeting with the economic buyer and technical stakeholders.",
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    return tasks


def _money_value(raw: str) -> float:
    match = re.search(r"([\d,.]+)\s*([kmb])?", raw.lower())
    if not match:
        return 0.0
    value = float(match.group(1).replace(",", ""))
    suffix = match.group(2)
    if suffix == "k":
        return value * 1_000
    if suffix == "m":
        return value * 1_000_000
    if suffix == "b":
        return value * 1_000_000_000
    return value


def _jira_ticket(
    call_id: str,
    account_name: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]],
    pre_dc_fields: Optional[Dict[str, str]],
    post_dc_record: Optional[Dict[str, Any]],
    summary: Dict[str, Any],
    cfg: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    progression = _bant_progression(discovery_snapshot)
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    bant_snapshot = {
        dim: after.get(dim) == "confirmed"
        for dim in ("budget", "authority", "need", "timeline")
    }
    if not all(bant_snapshot.values()):
        return None
    service_line = _first_text(
        _post_field(post_dc_record, "Service Line"),
        (pre_dc_fields or {}).get("Campaign Service - PreDC"),
        "services",
    )
    annual_potential = _first_text(_post_field(post_dc_record, "Accounts Annual Potential"))
    jira_cfg = cfg.get("jira") or {}
    try:
        threshold = float(jira_cfg.get("high_priority_threshold_usd") or 250_000)
    except (TypeError, ValueError):
        threshold = 250_000
    priority = "High" if _money_value(annual_potential) >= threshold else "Medium"
    project_key = str(jira_cfg.get("project_key") or "SALES")
    icp_bucket = _first_text((pre_dc_fields or {}).get("ICP Bucket"), _post_field(post_dc_record, "Was Pre DC ICP bucket correct"))
    labels = ["discovery-call", "bant-qualified"]
    if icp_bucket:
        labels.append(re.sub(r"[^a-z0-9]+", "-", icp_bucket.lower()).strip("-")[:40])
    description = "\n".join(
        [
            str(summary.get("headline") or f"{account_name} qualified after discovery."),
            "",
            "BANT snapshot:",
            *[f"- {BANT_LABELS[dim]}: {'confirmed' if ok else 'not confirmed'}" for dim, ok in bant_snapshot.items()],
            "",
            f"Next step: {summary.get('nextStepProposal') or 'Confirm next-step owner.'}",
        ]
    )
    return {
        "status": "draft_pending_approval",
        "summary": f"[DC Qualified] {account_name} — {service_line} opportunity",
        "description": description,
        "issueType": str(jira_cfg.get("issue_type") or "Review"),
        "priority": priority,
        "labels": labels,
        "projectKey": project_key,
        "bantSnapshot": bant_snapshot,
        "callId": call_id,
    }


def _research_sections(post_dc_record: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    fields = (post_dc_record or {}).get("fields") or {}
    if not fields:
        return []
    groups = [
        (
            "Post-DC outcome",
            ["Lead Stage", "Bottom Line Context", "Sales Strategy", "Reason Not A Fit - Post-DC"],
        ),
        (
            "Qualification",
            ["Budget", "Authority", "Need", "Timeline", "Was Pre DC ICP bucket correct"],
        ),
        (
            "Commercial context",
            ["Accounts Annual Potential", "Engagement Model", "Service Line", "Additional Info", "Attendees"],
        ),
    ]
    sections: List[Dict[str, Any]] = []
    for title, keys in groups:
        items = [
            {"label": key, "value": str(fields.get(key) or "").strip()}
            for key in keys
            if str(fields.get(key) or "").strip()
        ]
        if items:
            sections.append({"title": title, "items": items})
    return sections


def _citations(
    call_id: str,
    account_name: str,
    *,
    transcript_excerpt: str,
    pre_dc_fields: Optional[Dict[str, str]],
    hits: List[Dict[str, Any]],
) -> List[Citation]:
    citations: List[Citation] = [
        Citation(
            source_type="transcript",
            source_id=call_id,
            snippet=transcript_excerpt[:200] or f"Post-call artifacts for {account_name}",
            confidence=0.78,
        )
    ]
    crm_snippet = _first_text(
        (pre_dc_fields or {}).get("Have they described their needs"),
        (pre_dc_fields or {}).get("Company Description"),
        (pre_dc_fields or {}).get("Industry - PreDC"),
    )
    if crm_snippet:
        citations.append(
            Citation(
                source_type="crm_record",
                source_id=call_id,
                snippet=crm_snippet[:200],
                confidence=0.82,
            )
        )
    for i, hit in enumerate(hits[:2]):
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or "")[:200],
                confidence=float(hit.get("score", 0.7) or 0.7),
            )
        )
    return citations


def run_post_dc_pipeline(
    ctx: TenantContext,
    call_id: str,
    *,
    call: Optional[Dict[str, Any]] = None,
    pre_dc_fields: Optional[Dict[str, str]] = None,
    call_brief: Optional[Dict[str, Any]] = None,
    discovery_snapshot: Optional[Dict[str, Any]] = None,
    live_snapshot: Optional[Dict[str, Any]] = None,
    transcript_events: Optional[List[Dict[str, Any]]] = None,
    post_dc_record: Optional[Dict[str, Any]] = None,
) -> AgentEnvelope:
    settings = get_settings()
    cfg = get_agent_config_repository().get_config(ctx, "post_dc")
    model_policy = cfg.get("model_policy") or {}
    model = model_policy.get("model_name") or "claude-sonnet-4-6"
    fallback = model_policy.get("fallback_model_name") or "claude-sonnet-4-6"
    llm = LlmClient(api_key=settings.anthropic_api_key or None)

    account_name = _account_name(call, pre_dc_fields, call_id)
    transcript = _transcript_excerpt(transcript_events)
    gaps = _open_gaps(discovery_snapshot)
    recipients = _extract_recipients(call, pre_dc_fields)
    kb_query = " ".join(
        part
        for part in [
            account_name,
            (pre_dc_fields or {}).get("Industry - PreDC"),
            (pre_dc_fields or {}).get("Campaign Service - PreDC"),
            _post_field(post_dc_record, "Service Line"),
            "follow-up case study next steps",
        ]
        if part
    )
    hits, _ = _kb_search(ctx, kb_query, limit=4)

    context = {
        "call_id": call_id,
        "account_name": account_name,
        "call": call or {},
        "pre_dc_fields": pre_dc_fields or {},
        "call_brief": call_brief or {},
        "discovery_snapshot": _snapshot_result(discovery_snapshot),
        "live_snapshot": live_snapshot or {},
        "post_dc_record": post_dc_record or {},
        "transcript_excerpt": transcript,
        "kb_hits": hits[:4],
    }

    total_tokens = 0
    total_cost = 0.0
    trace_id = str(uuid.uuid4())
    model_used = "heuristic"

    summary_prompt = resolve_prompt(cfg, "summary", "post_dc/summary.txt")
    email_prompt = resolve_prompt(cfg, "email", "post_dc/email.txt")
    coaching_prompt = resolve_prompt(cfg, "coaching", "post_dc/coaching.txt")

    summary_json: Dict[str, Any] = {}
    if settings.anthropic_configured:
        completion = llm.complete(
            system=summary_prompt,
            user=json.dumps(context, ensure_ascii=False),
            model=model,
            fallback_model=fallback,
        )
        summary_json = _extract_json_block(completion.text) or {}
        total_tokens += completion.tokens_in + completion.tokens_out
        total_cost += completion.cost_usd
        trace_id = completion.trace_id
        model_used = completion.model

    if not summary_json:
        summary_json = _summary_fallback(
            account_name,
            discovery_snapshot=discovery_snapshot,
            live_snapshot=live_snapshot,
            pre_dc_fields=pre_dc_fields,
            post_dc_record=post_dc_record,
        )

    commitments = _commitments(transcript_events, live_snapshot, summary_json)

    email_json: Dict[str, Any] = {}
    if settings.anthropic_configured:
        email_context = {
            **context,
            "summary": summary_json,
            "commitments": commitments,
            "recipients": recipients,
            "open_gaps": gaps,
        }
        completion = llm.complete(
            system=email_prompt,
            user=json.dumps(email_context, ensure_ascii=False),
            model=model,
            fallback_model=fallback,
        )
        email_json = _extract_json_block(completion.text) or {}
        total_tokens += completion.tokens_in + completion.tokens_out
        total_cost += completion.cost_usd

    if not email_json:
        email_json = _email_fallback(account_name, recipients, summary_json, commitments, gaps)

    email_attachments = _email_attachments(call_brief, hits, account_name=account_name)

    email_draft = {
        "id": str(email_json.get("id") or f"email-{call_safe_id(call_id)}"),
        "to": email_json.get("to") if isinstance(email_json.get("to"), list) else recipients,
        "cc": email_json.get("cc") if isinstance(email_json.get("cc"), list) else [],
        "subject": str(email_json.get("subject") or f"Follow-up from our {account_name} discovery call"),
        "body_markdown": str(email_json.get("body_markdown") or email_json.get("body") or ""),
        "style_signals": email_json.get("style_signals")
        if isinstance(email_json.get("style_signals"), list)
        else ["concise", "consultative"],
        "commitments_referenced": email_json.get("commitments_referenced")
        if isinstance(email_json.get("commitments_referenced"), list)
        else commitments,
        "status": "draft_pending_approval",
        "attachments": email_attachments,
    }

    scorecard = _scorecard_fallback(discovery_snapshot, live_snapshot)
    if settings.anthropic_configured:
        coaching_context = {
            **context,
            "summary": summary_json,
            "open_gaps": gaps,
            "bant_progression": _bant_progression(discovery_snapshot),
        }
        completion = llm.complete(
            system=coaching_prompt,
            user=json.dumps(coaching_context, ensure_ascii=False),
            model=model,
            fallback_model=fallback,
        )
        parsed = _extract_json_block(completion.text) or {}
        parsed_scorecard = parsed.get("podScorecard")
        if isinstance(parsed_scorecard, list) and parsed_scorecard:
            scorecard = parsed_scorecard
        total_tokens += completion.tokens_in + completion.tokens_out
        total_cost += completion.cost_usd

    review = {
        "headline": str(summary_json.get("headline") or f"{account_name} post-call review"),
        "summary": summary_json.get("summary") if isinstance(summary_json.get("summary"), list) else [],
        "researchSections": _research_sections(post_dc_record),
        "podScorecard": scorecard,
        "learned": _learned(discovery_snapshot, post_dc_record),
        "openDiscoveryGaps": gaps,
        "discoveryBantCoverage": _bant_coverage(discovery_snapshot),
    }
    if not review["summary"]:
        review["summary"] = _summary_fallback(
            account_name,
            discovery_snapshot=discovery_snapshot,
            live_snapshot=live_snapshot,
            pre_dc_fields=pre_dc_fields,
            post_dc_record=post_dc_record,
        )["summary"]

    crm_tasks = _crm_tasks(
        call_id,
        account_name,
        discovery_snapshot=discovery_snapshot,
        commitments=commitments,
    )
    jira_ticket = _jira_ticket(
        call_id,
        account_name,
        discovery_snapshot=discovery_snapshot,
        pre_dc_fields=pre_dc_fields,
        post_dc_record=post_dc_record,
        summary=summary_json,
        cfg=cfg,
    )

    citations = _citations(
        call_id,
        account_name,
        transcript_excerpt=transcript,
        pre_dc_fields=pre_dc_fields,
        hits=hits,
    )

    envelope = AgentEnvelope(
        agent="post_dc",
        operation="review_produced",
        result={
            "callId": call_id,
            "accountName": account_name,
            "review": review,
            "task": {
                "emailDraft": email_draft,
                "crmTasks": crm_tasks,
            },
            "emailAttachments": email_attachments,
            "jiraTicket": jira_ticket,
            "coaching": {
                "podScorecard": scorecard,
                "bantProgression": _bant_progression(discovery_snapshot),
            },
            "kbSuggestions": [
                {
                    "assetId": str(hit.get("asset_id", "")),
                    "snippet": (hit.get("chunk_text") or "")[:240],
                    "score": hit.get("score"),
                }
                for hit in hits[:3]
            ],
        },
        citations=citations,
        confidence=0.82,
        cost={"tokens": total_tokens, "usd": total_cost, "model": model_used},
        trace_id=trace_id,
    )
    validate_envelope(envelope)
    return envelope
