from __future__ import annotations

import json
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.agents.content_generation_agent import (
    _pick_default_templates,
    _retrieve_studio_kb_hits,
    load_prompt,
)
from app.agents.relevant_content import build_relevant_content
from app.config import get_settings
from app.domain.content_studio_repository import ContentStudioRepository, get_content_studio_repository
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.services.deck_assembly_service import slide_plan_to_outline

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"

# ── Plan cache ────────────────────────────────────────────────────────────────
# Avoid re-running the expensive evidence + LLM pipeline for identical requests
# within the same deployment session. TTL is 10 minutes.
_PLAN_CACHE_TTL = 600
_plan_cache: Dict[str, Tuple[float, Any]] = {}
_plan_cache_lock = threading.Lock()


def _plan_cache_key(tenant_id: str, suggestion_id: str, title: str) -> str:
    return f"{tenant_id}:{suggestion_id}:{title.strip().lower()}:v2"


def _get_cached_plan(key: str) -> Optional[Any]:
    with _plan_cache_lock:
        entry = _plan_cache.get(key)
        if entry and (time.monotonic() - entry[0]) < _PLAN_CACHE_TTL:
            return entry[1]
        if entry:
            del _plan_cache[key]
    return None


def _set_cached_plan(key: str, value: Any) -> None:
    with _plan_cache_lock:
        # Evict stale entries when cache grows large
        now = time.monotonic()
        if len(_plan_cache) > 500:
            stale = [k for k, (ts, _) in _plan_cache.items() if now - ts >= _PLAN_CACHE_TTL]
            for k in stale:
                _plan_cache.pop(k, None)
        _plan_cache[key] = (now, value)


def _normalize_leads(leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for lead in leads:
        if not isinstance(lead, dict):
            continue
        out.append(
            {
                "call_id": str(lead.get("call_id") or lead.get("callId") or "").strip(),
                "account_name": str(lead.get("account_name") or lead.get("accountName") or "").strip(),
                "lead_name": str(lead.get("lead_name") or lead.get("leadName") or "").strip(),
                "industry": str(lead.get("industry") or "").strip(),
                "relevant_projects": [
                    item
                    for item in (lead.get("relevant_projects") or lead.get("relevantProjects") or [])
                    if isinstance(item, dict)
                ],
                "relevant_documents": [
                    item
                    for item in (lead.get("relevant_documents") or lead.get("relevantDocuments") or [])
                    if isinstance(item, dict)
                ],
                "recommended_deck": (
                    lead.get("recommended_deck")
                    if isinstance(lead.get("recommended_deck"), dict)
                    else lead.get("recommendedDeck")
                    if isinstance(lead.get("recommendedDeck"), dict)
                    else None
                ),
            }
        )
    return out


def _float_or(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _dedupe_evidence_projects(projects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for item in projects:
        asset_id = str(item.get("assetId") or item.get("asset_id") or item.get("id") or "")
        key = asset_id or str(item.get("title") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "asset_id": asset_id or key,
                "title": str(item.get("title") or "Project"),
                "source": str(item.get("source") or "project_database"),
                "snippet": str(item.get("summary") or item.get("snippet") or "")[:280],
                "score": _float_or(item.get("relevanceScore") or item.get("score"), 0),
                "details": str(item.get("details") or "")[:500],
                "source_project_id": str(item.get("source_project_id") or item.get("id") or ""),
            }
        )
    return out[:8]


def _kb_assets_payload(hits: List[Dict[str, Any]], ctx: TenantContext) -> List[Dict[str, Any]]:
    kb_repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for hit in hits:
        asset_id = str(hit.get("asset_id") or "").strip()
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        row = kb_repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
        out.append(
            {
                "asset_id": asset_id,
                "title": str(hit.get("title") or hit.get("asset_title") or (row or {}).get("title") or "KB document"),
                "snippet": str(hit.get("chunk_text") or hit.get("snippet") or "")[:280],
                "slide_count": int((row or {}).get("preview_slide_count") or 0),
                "score": float(hit.get("score") or 0),
            }
        )
    return out[:8]


def _dedupe_evidence_kb_assets(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        asset_id = str(item.get("assetId") or item.get("asset_id") or item.get("id") or "").strip()
        title = str(item.get("title") or item.get("name") or item.get("fileName") or item.get("file_name") or "").strip()
        key = asset_id or title.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        fmt = str(item.get("format") or item.get("mimeType") or item.get("mime_type") or "").lower()
        file_name = str(item.get("fileName") or item.get("file_name") or "").strip()
        is_deck = fmt in {"ppt", "pptx"} or file_name.lower().endswith((".ppt", ".pptx"))
        slide_count = int(
            item.get("slide_count")
            or item.get("previewSlideCount")
            or item.get("preview_slide_count")
            or (6 if is_deck else 0)
        )
        out.append(
            {
                "asset_id": asset_id or key,
                "title": title or "KB document",
                "snippet": str(item.get("snippet") or item.get("previewText") or item.get("preview_text") or "")[:280],
                "slide_count": slide_count,
                "score": _float_or(item.get("relevanceScore") or item.get("score"), 0.85),
                "file_name": file_name,
                "format": fmt,
            }
        )
    return out[:8]


MIN_SLIDE_COUNT = 6


def _two_line_body(line1: str, line2: str) -> str:
    first = str(line1 or "").strip()
    second = str(line2 or "").strip()
    if not first:
        first = "Frame the buyer problem in concrete terms."
    if not second:
        second = "Connect the message to the account's priorities and timeline."
    if not first.endswith((".", "!", "?")):
        first = f"{first}."
    if not second.endswith((".", "!", "?")):
        second = f"{second}."
    return f"{first}\n{second}"


def _normalize_slide_body(body: str, *, heading: str = "", intent: str = "") -> str:
    text = str(body or "").strip()
    if not text:
        return _two_line_body(
            intent or heading or "Explain why this slide matters for the buyer.",
            "Tie the takeaway to evidence from projects or the knowledge base.",
        )
    if "\n" in text:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if len(lines) >= 2:
            return _two_line_body(lines[0], lines[1])
        return _two_line_body(lines[0], intent or "Make the outcome tangible for the buying team.")
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    if len(sentences) >= 2:
        return _two_line_body(sentences[0], sentences[1])
    return _two_line_body(text, intent or "Translate this proof point into buyer-ready language.")


def _ensure_slide_plan_quality(
    slide_plan: List[Dict[str, Any]],
    *,
    title: str,
    artifact_type: str,
    generation_reason: str,
    needed_for: str,
    content_requirements: str,
    leads: List[Dict[str, Any]],
    evidence_projects: List[Dict[str, Any]],
    evidence_kb: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    plan = [dict(slide) for slide in slide_plan if isinstance(slide, dict)]
    for slide in plan:
        slide["body"] = _normalize_slide_body(
            str(slide.get("body") or ""),
            heading=str(slide.get("heading") or ""),
            intent=str(slide.get("intent") or ""),
        )

    lead_count = len(leads) or 1
    industries = sorted({l.get("industry") for l in leads if l.get("industry")})
    industry_label = industries[0] if industries else "this vertical"
    filler_specs = [
        (
            f"{industry_label} market context",
            f"Buyers in {industry_label} are under pressure to move faster with less risk.",
            f"This deck should show how {title} answers that pressure with proof, not promises.",
        ),
        (
            "Why this matters now",
            generation_reason or f"Multiple leads need a credible {artifact_type.replace('_', ' ')} before their next call.",
            needed_for or f"Equip reps to run a sharper conversation across {lead_count} upcoming meeting{'s' if lead_count != 1 else ''}.",
        ),
        (
            "Solution storyline",
            f"Position {title} as the anchor asset for the account conversation.",
            content_requirements or "Translate internal evidence into buyer-ready language the team can reuse immediately.",
        ),
        (
            "Proof from delivery",
            "Show measurable outcomes from a comparable customer engagement.",
            "Highlight the metric, the motion, and why it maps to this account's goals.",
        ),
        (
            "Knowledge base support",
            "Pull approved language and visuals from existing internal assets.",
            "Reuse strong slides where possible and customize only what the buyer context requires.",
        ),
        (
            "Recommended next steps",
            f"Close with the decision the buyer should make after reviewing {title}.",
            "Spell out the follow-up meeting, owners, and the proof still needed to advance the deal.",
        ),
    ]

    evidence_refs: List[str] = []
    for proj in evidence_projects[:2]:
        evidence_refs.append(f"project:{proj['asset_id']}")
    for kb in evidence_kb[:2]:
        evidence_refs.append(f"kb:{kb['asset_id']}")

    slot = len(plan) + 1
    filler_index = 0
    while len(plan) < MIN_SLIDE_COUNT:
        heading, line1, line2 = filler_specs[filler_index % len(filler_specs)]
        filler_index += 1
        plan.append(
            {
                "slide": slot,
                "heading": heading[:72],
                "body": _two_line_body(line1, line2),
                "intent": needed_for or generation_reason or "Advance the buyer conversation",
                "visual": "Supporting chart, quote, or account visual",
                "mode": "generate",
                "evidence_refs": evidence_refs[:2],
                "data_points": [line1[:120], line2[:120]],
            }
        )
        slot += 1

    for index, slide in enumerate(plan, start=1):
        slide["slide"] = index
    return plan[:8]


def _heuristic_slide_plan(
    *,
    title: str,
    artifact_type: str,
    generation_reason: str,
    needed_for: str,
    content_requirements: str = "",
    leads: List[Dict[str, Any]],
    evidence_projects: List[Dict[str, Any]],
    evidence_kb: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    lead_count = len(leads) or 1
    industries = sorted({l.get("industry") for l in leads if l.get("industry")})
    industry_label = industries[0] if len(industries) == 1 else (industries[0] if industries else "")

    data_points: List[str] = []
    if generation_reason:
        data_points.append(generation_reason)
    if needed_for:
        data_points.append(needed_for)
    if content_requirements and content_requirements not in data_points:
        data_points.append(content_requirements)
    for lead in leads[:4]:
        account = lead.get("account_name") or ""
        if account:
            data_points.append(f"{account} needs this asset")

    evidence_refs: List[str] = []
    for proj in evidence_projects[:2]:
        evidence_refs.append(f"project:{proj['asset_id']}")
    for kb in evidence_kb[:2]:
        evidence_refs.append(f"kb:{kb['asset_id']}")

    plan: List[Dict[str, Any]] = [
        {
            "slide": 1,
            "heading": title[:72],
            "body": _two_line_body(
                f"Open with why this {artifact_type.replace('_', ' ')} matters for {lead_count} upcoming lead conversation{'s' if lead_count != 1 else ''}.",
                generation_reason or needed_for or "Set the buyer context before diving into proof.",
            ),
            "intent": needed_for or generation_reason or "Set context for the buyer conversation",
            "visual": "Account or industry hero visual",
            "mode": "generate",
            "evidence_refs": evidence_refs[:2],
            "data_points": data_points[:3],
        },
        {
            "slide": 2,
            "heading": f"{industry_label or 'Market'} urgency"[:72],
            "body": _two_line_body(
                generation_reason or f"Buyers in {industry_label or 'this segment'} need sharper enablement before the next call.",
                needed_for or content_requirements or "Show the gap this asset closes across the affected accounts.",
            ),
            "intent": "Explain why the team needs this asset now",
            "visual": "Problem framing or urgency chart",
            "mode": "generate",
            "evidence_refs": evidence_refs[:1],
            "data_points": data_points[:2],
        },
        {
            "slide": 3,
            "heading": "What to create",
            "body": _two_line_body(
                content_requirements or f"Define the storyline for {title} in buyer-ready language.",
                f"Make the asset reusable across {lead_count} lead{'s' if lead_count != 1 else ''} without rewriting from scratch each time.",
            ),
            "intent": "Clarify the asset scope and message",
            "visual": "Outline or story arc",
            "mode": "generate",
            "evidence_refs": evidence_refs[:1],
            "data_points": data_points[:2],
        },
    ]

    slot = 4
    for proj in evidence_projects[:2]:
        snippet = str(proj.get("snippet") or "Show measurable outcomes from a similar engagement.")
        plan.append(
            {
                "slide": slot,
                "heading": str(proj.get("title") or "Relevant project proof")[:72],
                "body": _two_line_body(
                    snippet,
                    "Connect this delivery proof to the buyer outcome your team is trying to create.",
                ),
                "intent": "Ground the story in project database evidence",
                "visual": "Case metrics or customer logo",
                "mode": "generate",
                "evidence_refs": [f"project:{proj['asset_id']}"],
                "data_points": [snippet[:120]],
            }
        )
        slot += 1

    reuse_candidate = next((kb for kb in evidence_kb if int(kb.get("slide_count") or 0) >= 3), None)
    if reuse_candidate and artifact_type == "deck":
        snippet = str(reuse_candidate.get("snippet") or "Reuse an approved slide from the knowledge base.")
        plan.append(
            {
                "slide": slot,
                "heading": str(reuse_candidate.get("title") or "Proven vertical slide")[:72],
                "body": _two_line_body(
                    snippet,
                    "Reuse this approved slide and customize only the buyer-specific details.",
                ),
                "intent": "Leverage existing vertical content",
                "visual": "Existing deck slide",
                "mode": "reuse",
                "evidence_refs": [f"kb:{reuse_candidate['asset_id']}"],
                "data_points": [snippet[:120]],
                "reuse": {
                    "source_asset_id": reuse_candidate["asset_id"],
                    "source_slide_index": 3,
                    "source_vertical": industry_label or "Knowledge base",
                    "rationale": "Strong existing slide matches the suggested topic",
                },
            }
        )
        slot += 1

    for kb in evidence_kb[:2]:
        if slot > MIN_SLIDE_COUNT:
            break
        if reuse_candidate and kb.get("asset_id") == reuse_candidate.get("asset_id"):
            continue
        snippet = str(kb.get("snippet") or "Supporting evidence from the content library.")
        plan.append(
            {
                "slide": slot,
                "heading": str(kb.get("title") or "Knowledge base proof point")[:72],
                "body": _two_line_body(
                    snippet,
                    "Use this internal proof to reinforce credibility without inventing new claims.",
                ),
                "intent": "Cite approved internal content",
                "visual": "Proof chart or quote",
                "mode": "generate",
                "evidence_refs": [f"kb:{kb['asset_id']}"],
                "data_points": [snippet[:120]],
            }
        )
        slot += 1

    plan.append(
        {
            "slide": slot,
            "heading": "Recommended next steps",
            "body": _two_line_body(
                "Summarize the path forward and the decision the buyer should make.",
                f"Prepare the team for {lead_count} upcoming conversation{'s' if lead_count != 1 else ''} with a clear follow-up ask.",
            ),
            "intent": "Close with clear next actions",
            "visual": "Timeline or checklist",
            "mode": "generate",
            "evidence_refs": evidence_refs[:1],
            "data_points": [f"Prepared for {lead_count} upcoming conversation{'s' if lead_count != 1 else ''}"],
        }
    )
    return _ensure_slide_plan_quality(
        plan,
        title=title,
        artifact_type=artifact_type,
        generation_reason=generation_reason,
        needed_for=needed_for,
        content_requirements=content_requirements,
        leads=leads,
        evidence_projects=evidence_projects,
        evidence_kb=evidence_kb,
    )


def _parse_llm_plan(raw: str) -> Optional[Dict[str, Any]]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    if not isinstance(data, dict):
        return None
    slides = data.get("slide_plan")
    if not isinstance(slides, list) or not slides:
        return None
    return data


def _gather_lead_evidence(
    ctx: TenantContext,
    lead: Dict[str, Any],
    generation_reason: str,
    needed_for: str,
    industry: str,
    title: str,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Return (evidence_projects, explicit_kb_assets) for a single lead."""
    proj = _dedupe_evidence_projects(lead.get("relevant_projects") or [])
    kb = _dedupe_evidence_kb_assets(lead.get("relevant_documents") or [])
    recommended_deck = lead.get("recommended_deck")
    if isinstance(recommended_deck, dict):
        kb.extend(_dedupe_evidence_kb_assets([recommended_deck]))
    research = {
        "needs": generation_reason,
        "industry": lead.get("industry") or industry,
        "intersection": needed_for,
        "campaign_service": title,
    }
    bundle = build_relevant_content(ctx, lead.get("account_name") or title, research, limit=10)
    proj.extend(_dedupe_evidence_projects(bundle.get("relevantProjects") or []))
    return proj, kb


def run_content_plan(
    ctx: TenantContext,
    *,
    suggestion_id: str,
    title: str,
    artifact_type: str,
    source: str,
    generation_reason: str,
    needed_for: str,
    source_path: str = "",
    content_requirements: str = "",
    extra_context: Optional[Dict[str, Any]] = None,
    industry: str = "",
    leads: Optional[List[Dict[str, Any]]] = None,
    kb_asset_ids: Optional[List[str]] = None,
    repo: Optional[ContentStudioRepository] = None,
) -> AgentEnvelope:
    """Build a proactive SuggestionPlan from leads, project DB, KB, and templates."""
    repo = repo or get_content_studio_repository()
    settings = get_settings()
    normalized_leads = _normalize_leads(leads or [])
    lead_count = len(normalized_leads) or 1
    extra_context = extra_context or {}

    # ── Cache check ───────────────────────────────────────────────────────────
    tenant_id = str(getattr(ctx, "tenant_id", "") or getattr(ctx, "org_id", "") or "")
    cache_key = _plan_cache_key(tenant_id, suggestion_id, title)
    cached = _get_cached_plan(cache_key)
    if cached is not None:
        return cached

    # ── Build search query ────────────────────────────────────────────────────
    query_parts = [title, generation_reason, needed_for, content_requirements, industry]
    for lead in normalized_leads[:6]:
        query_parts.extend([lead.get("account_name", ""), lead.get("industry", "")])
    query = " ".join(p for p in query_parts if p).strip()

    # ── Gather evidence in parallel ───────────────────────────────────────────
    # Run per-lead evidence (vector DB calls) + KB search + template pick concurrently
    evidence_projects: List[Dict[str, Any]] = []
    explicit_kb_assets: List[Dict[str, Any]] = []
    kb_hits: List[Dict[str, Any]] = []
    best_template: Optional[Dict[str, Any]] = None
    recommendations: List[Dict[str, Any]] = []

    brief_stub = {
        "needed_for": needed_for,
        "generation_reason": generation_reason,
        "asset_name": title,
        "industry": industry,
        "content_context": needed_for or generation_reason,
    }
    project_stub = {"artifactType": artifact_type, "title": title}

    with ThreadPoolExecutor(max_workers=min(6, len(normalized_leads[:4]) + 2)) as pool:
        lead_futures = {
            pool.submit(
                _gather_lead_evidence, ctx, lead, generation_reason, needed_for, industry, title
            ): lead
            for lead in normalized_leads[:4]
        }
        kb_future = pool.submit(_retrieve_studio_kb_hits, ctx, query)
        tpl_future = pool.submit(_pick_default_templates, ctx, repo, project_stub, brief_stub, title)

        for fut in as_completed(lead_futures):
            try:
                proj, kb = fut.result()
                evidence_projects.extend(proj)
                explicit_kb_assets.extend(kb)
            except Exception:
                pass

        try:
            kb_hits = kb_future.result()
        except Exception:
            kb_hits = []

        try:
            best_template, recommendations = tpl_future.result()
        except Exception:
            best_template, recommendations = None, []

    evidence_projects = _dedupe_evidence_projects(evidence_projects)

    if kb_asset_ids:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
        kb_repo = get_kb_repository()
        existing_ids = {str(h.get("asset_id")) for h in kb_hits}
        for asset_id in kb_asset_ids:
            if asset_id in existing_ids:
                continue
            row = kb_repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
            if row:
                kb_hits.insert(0, {"asset_id": asset_id, "title": row.get("title"), "chunk_text": "", "score": 0.95})

    evidence_kb = _dedupe_evidence_kb_assets(explicit_kb_assets + _kb_assets_payload(kb_hits, ctx))

    slide_plan = _heuristic_slide_plan(
        title=title,
        artifact_type=artifact_type,
        generation_reason=generation_reason,
        needed_for=needed_for,
        content_requirements=content_requirements,
        leads=normalized_leads,
        evidence_projects=evidence_projects,
        evidence_kb=evidence_kb,
    )
    plan_summary = (
        f"Planned {len(slide_plan)} slides for {lead_count} lead{'s' if lead_count != 1 else ''}. "
        f"Grounded in {len(evidence_projects)} project record{'s' if len(evidence_projects) != 1 else ''} "
        f"and {len(evidence_kb)} KB asset{'s' if len(evidence_kb) != 1 else ''}."
    )

    model_name = "rule-based-plan"
    cost_usd = 0.0
    tokens = 0

    if settings.openai_configured:
        system = load_prompt("content/plan/v1.0.0.md")
        user_payload = json.dumps(
            {
                "title": title,
                "artifact_type": artifact_type,
                "generation_reason": generation_reason,
                "needed_for": needed_for,
                "source_path": source_path,
                "content_requirements": content_requirements,
                "context": extra_context,
                "industry": industry,
                "lead_count": lead_count,
                "leads": normalized_leads,
                "evidence_projects": evidence_projects,
                "evidence_kb": evidence_kb,
                "template": {
                    "template_id": (best_template or {}).get("id"),
                    "name": (best_template or {}).get("name"),
                },
            },
            indent=2,
        )
        try:
            completion = LlmClient(openai_api_key=settings.openai_api_key or None).complete(
                system=system,
                user=user_payload,
                max_tokens=1400,
                model="gpt-5.4-mini",
                fallback_model="gpt-5.4-mini",
            )
            parsed = _parse_llm_plan(completion.text)
            if parsed and isinstance(parsed.get("slide_plan"), list):
                slide_plan = _ensure_slide_plan_quality(
                    parsed["slide_plan"],
                    title=title,
                    artifact_type=artifact_type,
                    generation_reason=generation_reason,
                    needed_for=needed_for,
                    content_requirements=content_requirements,
                    leads=normalized_leads,
                    evidence_projects=evidence_projects,
                    evidence_kb=evidence_kb,
                )
                plan_summary = str(parsed.get("plan_summary") or plan_summary)
            model_name = completion.model
            cost_usd = completion.cost_usd
            tokens = completion.tokens_in + completion.tokens_out
        except Exception:
            pass

    suggestion_plan: Dict[str, Any] = {
        "suggestion_id": suggestion_id,
        "source": source,
        "generation_reason": generation_reason,
        "needed_for": needed_for,
        "source_path": source_path,
        "content_requirements": content_requirements,
        "context": extra_context,
        "lead_count": lead_count,
        "leads": normalized_leads,
        "industry": industry,
        "artifact_type": artifact_type,
        "title": title,
        "plan_summary": plan_summary,
        "evidence": {
            "projects": evidence_projects,
            "kb_assets": evidence_kb,
        },
        "template": {
            "template_id": str((best_template or {}).get("id") or ""),
            "name": str((best_template or {}).get("name") or ""),
            "rationale": recommendations[0]["rationale"] if recommendations else "",
        },
        "recommended_templates": recommendations,
        "slide_plan": slide_plan,
    }

    citations: List[Citation] = []
    for proj in evidence_projects[:3]:
        citations.append(
            Citation(
                source_type="project_database",
                source_id=str(proj["asset_id"]),
                snippet=str(proj.get("snippet") or "")[:200],
                confidence=float(proj.get("score") or 0.8),
            )
        )
    for kb in evidence_kb[:3]:
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=str(kb["asset_id"]),
                snippet=str(kb.get("snippet") or "")[:200],
                confidence=float(kb.get("score") or 0.85),
            )
        )

    envelope = AgentEnvelope(
        agent="content_plan",
        operation="content_plan",
        result={"suggestion_plan": suggestion_plan, "slide_outline": slide_plan_to_outline(slide_plan)},
        citations=citations,
        confidence=0.88 if evidence_projects or evidence_kb else 0.72,
        cost={"tokens": tokens, "usd": cost_usd, "model": model_name},
        trace_id=str(uuid.uuid4()),
        creative=True,
    )
    validate_envelope(envelope)
    _set_cached_plan(cache_key, envelope)
    return envelope
