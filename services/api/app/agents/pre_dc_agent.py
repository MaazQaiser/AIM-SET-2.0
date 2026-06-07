from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.config import get_settings
from app.domain.agent_config_repository import get_agent_config_repository
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from app.agents.relevant_content import build_relevant_content
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"

COMPANY_NAME_KEY = "Company Name-PreDC"
NEEDS_CONTENT_FALLBACK = "Needs/content is not identified yet."


def load_prompt(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def resolve_prompt(cfg: Dict[str, Any], operation: str, default_path: str) -> str:
    overrides = cfg.get("workflow_prompts") or cfg.get("pre_dc_prompts") or {}
    custom = (overrides.get(operation) or "").strip()
    if custom:
        return custom
    file_text = load_prompt(default_path)
    return file_text or f"You are the Pre-DC Agent ({operation})."


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


def research_from_fields(fields: Dict[str, str]) -> Dict[str, str]:
    return {
        "company_name": fields.get(COMPANY_NAME_KEY, ""),
        "needs": fields.get("Have they described their needs", ""),
        "company_description": fields.get("Company Description", ""),
        "deal_stage": fields.get("Company Stage", "Discovery"),
        "icp_bucket": fields.get("ICP Bucket", ""),
        "industry": fields.get("Industry - PreDC", ""),
        "intersection": fields.get("Intersection areas b/w tkxel & company", ""),
        "campaign_service": fields.get("Campaign Service - PreDC", ""),
        "other": fields.get("Other Information", ""),
        "relevance": fields.get("What is their relevance to Tkxel?", ""),
        "discovery_date": fields.get("Discovery Call Date (PKT)", ""),
        "discovery_time": fields.get("Discovery Call Time (PKT)", ""),
    }


def _heuristic_summary(fields: Dict[str, str], account_name: str) -> str:
    parts = [
        fields.get("Intersection areas b/w tkxel & company", ""),
        fields.get("Have they described their needs", ""),
        fields.get("What is their relevance to Tkxel?", ""),
    ]
    joined = " ".join(p.strip() for p in parts if p and p.strip())
    if joined:
        return joined[:600]
    desc = (fields.get("Company Description") or "").strip()
    if desc:
        return desc[:400] + ("…" if len(desc) > 400 else "")
    return f"Discovery call prep for **{account_name}**."


from app.domain.brief_summary_sections import (
    SUMMARY_SECTION_TITLES,
    canonicalize_summary_section_titles,
)


def _summary_section(section_id: str, content: str, fallback: str) -> Dict[str, str]:
    return {
        "id": section_id,
        "title": SUMMARY_SECTION_TITLES[section_id],
        "content": (content.strip() or fallback).strip(),
    }


def _compact_text(value: Any, limit: int = 260) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _without_outreach_details(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    blocked_patterns = (
        "outreach",
        "cold email",
        "email campaign",
        "email and phone",
        "phone and email",
        "via email",
        "via phone",
        "lead source",
        "how we landed",
        "how we got",
        "responded",
        "reply",
        "openness to a call",
        "bandwidth",
        "unresponsive",
        "follow-up",
        "follow up",
        "re-engaged",
        "reengaged",
        "scheduled",
        "scheduling",
        "schedule the call",
        "booked",
        "availability",
        "calendar invite",
        "meeting invite",
        "meeting has been confirmed",
        "meeting confirmed",
        "discovery call",
        "intro call",
        "prior to the call",
        "nda",
        "company details",
        "prospect is",
        "founder & ceo",
        "founder and ceo",
    )
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept = [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
        and not any(pattern in sentence.lower() for pattern in blocked_patterns)
    ]
    return " ".join(kept).strip()


def _extract_need_phrase(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return ""
    patterns = (
        r"\b(?:would\s+)?need(?:s|ed)?(?:\s+(?:is|are|to))?\s+(.+?)(?:,?\s+(?:though|but|however)\b|[.!?]|$)",
        r"\b(?:want|wants|wanted|looking for|seeking|requires?|requested|interested in|would like)\s+(?:to\s+)?(.+?)(?:,?\s+(?:though|but|however)\b|[.!?]|$)",
        r"\b(?:goal|objective)\s+(?:is|was)\s+(?:to\s+)?(.+?)(?:,?\s+(?:though|but|however)\b|[.!?]|$)",
    )
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            need = _compact_text(match.group(1).strip(" ,;:-"), 180)
            if need:
                return need.rstrip(".")
    return ""


def _normalize_need_text(value: str) -> str:
    text = str(value or "").strip()
    text = re.sub(
        r"^(?:their\s+)?(?:stated\s+)?(?:need|needs|needed|want|wants|wanted|looking for|seeking|requires?|requested|interested in)(?:\s+(?:is|are|to))?\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return text.strip().rstrip(".")


def _business_need_text(value: str, *, allow_plain: bool = False) -> str:
    clean = _without_outreach_details(value)
    extracted = _extract_need_phrase(clean) or _extract_need_phrase(value)
    if extracted:
        return _normalize_need_text(extracted)
    if allow_plain and clean:
        return _normalize_need_text(clean)
    return ""


def _pain_point_text(value: str, *, allow_plain: bool = False) -> str:
    clean = _without_outreach_details(value)
    if not clean:
        return ""
    pain_patterns = (
        "pain",
        "challenge",
        "issue",
        "problem",
        "friction",
        "slow",
        "slows",
        "manual",
        "bottleneck",
        "gap",
        "blocker",
        "struggle",
        "difficulty",
        "risk",
        "unable",
        "lack",
        "lacks",
    )
    sentences = re.split(r"(?<=[.!?])\s+", clean)
    matches = [
        sentence.strip().rstrip(".")
        for sentence in sentences
        if sentence.strip()
        and any(pattern in sentence.lower() for pattern in pain_patterns)
    ]
    if matches:
        return _compact_text("; ".join(matches), 220)
    if allow_plain:
        return _normalize_need_text(clean)
    return ""


def _customer_profile_summary(fields: Dict[str, str], account_name: str) -> str:
    about_bits = [
        fields.get("Company Description", ""),
        fields.get("Industry - PreDC", ""),
        fields.get("Company Type ICP - PreDC", ""),
        fields.get("Company Stage", ""),
        fields.get("Company Stage-PreDC", ""),
        fields.get("ICP Bucket", ""),
    ]
    need_bits = [
        (fields.get("Have they described their needs", ""), True),
        (fields.get("Need-PreDC", ""), True),
        (fields.get("Other Information", ""), False),
    ]

    about = _compact_text(_without_outreach_details(" ".join(bit for bit in about_bits if bit)), 320)
    need = _compact_text(
        "; ".join(
            bit for bit in (_business_need_text(value, allow_plain=allow_plain) for value, allow_plain in need_bits) if bit
        ),
        240,
    )

    parts = []
    if about:
        parts.append(f"{account_name} is about {about}")
    else:
        parts.append(f"{account_name} has limited company profile detail captured in the imported Pre-DC row")
    if need:
        parts.append(f"Their stated need is {need}")
    else:
        parts.append(NEEDS_CONTENT_FALLBACK)
    return ". ".join(part.strip().rstrip(".") for part in parts if part).strip() + "."


def _customer_pain_points_summary(fields: Dict[str, str]) -> str:
    pain_bits = [
        _pain_point_text(fields.get("Intersection areas b/w tkxel & company", "")),
        _pain_point_text(fields.get("Have they described their needs", "")),
        _pain_point_text(fields.get("Need-PreDC", "")),
        _pain_point_text(fields.get("Other Information", "")),
    ]
    summary = _compact_text("; ".join(bit for bit in pain_bits if bit), 320)
    return summary or NEEDS_CONTENT_FALLBACK


def _heuristic_summary_sections(fields: Dict[str, str], account_name: str) -> List[Dict[str, str]]:
    action_bits = [
        fields.get("Campaign Service - PreDC", ""),
        fields.get("Discovery Call Date (PKT)", ""),
        fields.get("Discovery Call Time (PKT)", ""),
    ]
    relevance_bits = [
        fields.get("What is their relevance to Tkxel?", ""),
        fields.get("Intersection areas b/w tkxel & company", ""),
        fields.get("ICP Bucket", ""),
    ]

    action_context = " ".join(bit for bit in action_bits if bit).strip()
    if action_context:
        action_text = (
            f"Use the discovery call to validate the main need, confirm timeline and decision process, "
            f"and prepare content around {action_context}."
        )
    else:
        action_text = (
            "Use the discovery call to validate the main need, confirm timeline and decision process, "
            "and identify which sales assets should be prepared next."
        )

    return [
        _summary_section(
            "customer_profile",
            _customer_profile_summary(fields, account_name),
            f"{account_name} is queued for discovery prep. Use the imported Pre-DC record as the source of truth.",
        ),
        _summary_section(
            "customer_pain_points",
            _customer_pain_points_summary(fields),
            "No specific pain point was captured yet. Use the call to uncover the business problem, current workflow, and urgency.",
        ),
        _summary_section("suggested_action", action_text, action_text),
        _summary_section(
            "relevance",
            " ".join(bit for bit in relevance_bits if bit),
            "Relevance should be confirmed by connecting the prospect's stated need to Tkxel's matching services, proof points, and delivery model.",
        ),
    ]


def _normalize_summary_sections(parsed: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
    if not parsed:
        return []
    raw_sections = parsed.get("sections")
    if isinstance(raw_sections, list):
        out: List[Dict[str, str]] = []
        for item in raw_sections:
            if not isinstance(item, dict):
                continue
            section_id = str(item.get("id") or "").strip()
            if section_id not in SUMMARY_SECTION_TITLES:
                continue
            content = str(item.get("content") or item.get("body") or "").strip()
            if not content:
                continue
            out.append(
                {
                    "id": section_id,
                    "title": SUMMARY_SECTION_TITLES[section_id],
                    "content": content,
                }
            )
        if out:
            by_id = {s["id"]: s for s in out}
            return [by_id[key] for key in SUMMARY_SECTION_TITLES if key in by_id]

    aliases = {
        "customer_profile": ["customer_profile", "customer_profile_summary", "profile"],
        "customer_pain_points": ["customer_pain_points", "pain_points", "customer_pains"],
        "suggested_action": ["suggested_action", "actions", "next_action"],
        "relevance": ["relevance", "why_relevant", "tkxel_relevance"],
    }
    out = []
    for section_id, keys in aliases.items():
        value = next((parsed.get(key) for key in keys if parsed.get(key)), "")
        if value:
            out.append(
                {
                    "id": section_id,
                    "title": SUMMARY_SECTION_TITLES[section_id],
                    "content": str(value).strip(),
                }
            )
    return out


def _complete_summary_sections(
    sections: List[Dict[str, str]], fields: Dict[str, str], account_name: str
) -> List[Dict[str, str]]:
    fallback_by_id = {section["id"]: section for section in _heuristic_summary_sections(fields, account_name)}
    section_by_id: Dict[str, Dict[str, str]] = {}
    for section in sections:
        section_id = section.get("id", "")
        content = section.get("content", "").strip()
        if section_id in SUMMARY_SECTION_TITLES and content:
            section_by_id[section_id] = {
                "id": section_id,
                "title": SUMMARY_SECTION_TITLES[section_id],
                "content": content,
            }
    return [
        section_by_id.get(section_id) or fallback_by_id[section_id]
        for section_id in SUMMARY_SECTION_TITLES
    ]


def _enrich_customer_profile_section(
    sections: List[Dict[str, str]], fields: Dict[str, str], account_name: str
) -> List[Dict[str, str]]:
    profile = _customer_profile_summary(fields, account_name)
    enriched: List[Dict[str, str]] = []
    for section in sections:
        if section.get("id") == "customer_profile":
            enriched.append(
                {
                    "id": "customer_profile",
                    "title": SUMMARY_SECTION_TITLES["customer_profile"],
                    "content": profile,
                }
            )
        else:
            enriched.append(section)
    return enriched


def _enrich_customer_pain_points_section(
    sections: List[Dict[str, str]], fields: Dict[str, str]
) -> List[Dict[str, str]]:
    pain_points = _customer_pain_points_summary(fields)
    if not pain_points:
        return sections
    enriched: List[Dict[str, str]] = []
    for section in sections:
        if section.get("id") == "customer_pain_points":
            enriched.append(
                {
                    "id": "customer_pain_points",
                    "title": SUMMARY_SECTION_TITLES["customer_pain_points"],
                    "content": pain_points,
                }
            )
        else:
            enriched.append(section)
    return enriched


def _score_pct(value: Any) -> Optional[int]:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if score <= 0:
        return None
    return round(max(0.0, min(1.0, score)) * 100)


def _top_relevant_project(relevant: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    projects = [p for p in relevant.get("relevantProjects") or [] if isinstance(p, dict)]
    if not projects:
        return None

    def score(project: Dict[str, Any]) -> float:
        source_bonus = 0.05 if project.get("source") in ("project_database", "dc_notes") else 0.0
        try:
            return float(project.get("relevanceScore") or 0) + source_bonus
        except (TypeError, ValueError):
            return source_bonus

    return max(projects, key=score)


def _relevant_projects(relevant: Dict[str, Any]) -> List[Dict[str, Any]]:
    projects = [p for p in relevant.get("relevantProjects") or [] if isinstance(p, dict)]
    if not projects:
        return []

    def score(project: Dict[str, Any]) -> float:
        source_bonus = 0.05 if project.get("source") in ("project_database", "dc_notes") else 0.0
        try:
            return float(project.get("relevanceScore") or 0) + source_bonus
        except (TypeError, ValueError):
            return source_bonus

    return sorted(projects, key=score, reverse=True)


def _top_relevant_document(relevant: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    documents = [d for d in relevant.get("relevantDocuments") or [] if isinstance(d, dict)]
    if not documents:
        return None

    def score(document: Dict[str, Any]) -> float:
        try:
            return float(document.get("relevanceScore") or 0)
        except (TypeError, ValueError):
            return 0.0

    return max(documents, key=score)


def _relevance_level(score: int) -> str:
    if score >= 85:
        return "Very high"
    if score >= 70:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def _manual_relevance_level(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    percent_match = re.search(r"\b(\d{1,3})\s*%", text)
    if percent_match:
        pct = max(0, min(100, int(percent_match.group(1))))
        return f"{_relevance_level(pct)} relevance ({pct}%)."

    lowered = text.lower()
    if any(word in lowered for word in ("very high", "excellent", "strong", "high")):
        return "High relevance."
    if any(word in lowered for word in ("medium", "moderate", "good")):
        return "Medium relevance."
    if any(word in lowered for word in ("low", "weak", "poor")):
        return "Low relevance."
    return ""


def _project_names_sentence(projects: List[Dict[str, Any]]) -> str:
    names: List[str] = []
    seen = set()
    for project in projects:
        title = _compact_text(project.get("title") or project.get("name") or "", 120)
        key = title.lower()
        if title and key not in seen:
            names.append(title)
            seen.add(key)
    if not names:
        return "Relevant projects done: 0."

    shown = names[:5]
    suffix = f", +{len(names) - len(shown)} more" if len(names) > len(shown) else ""
    project_word = "project" if len(names) == 1 else "projects"
    return f"Relevant {project_word} done: {len(names)} - {', '.join(shown)}{suffix}."


def _manual_relevance_value(value: str) -> str:
    manual = _manual_relevance_level(value).rstrip(".")
    return manual.replace(" relevance", "").strip()


def _kb_relevance_summary(
    account_name: str,
    research: Dict[str, str],
    relevant: Dict[str, Any],
    existing_relevance: str,
) -> str:
    projects = _relevant_projects(relevant)
    document = _top_relevant_document(relevant)
    scored_matches = [
        *[_score_pct(project.get("relevanceScore")) for project in projects],
        _score_pct((document or {}).get("relevanceScore")),
    ]
    scores = [score for score in scored_matches if score is not None]
    projects_sentence = _project_names_sentence(projects)
    if scores:
        score = max(scores)
        return f"{projects_sentence} Overall relevance: {score}%."

    manual_level = _manual_relevance_value(existing_relevance) or _manual_relevance_value(research.get("relevance", ""))
    if manual_level:
        return f"{projects_sentence} Overall relevance: {manual_level}."

    return f"{projects_sentence} Overall relevance score is not available yet for {account_name}."


def _enrich_relevance_section(
    sections: List[Dict[str, str]],
    *,
    account_name: str,
    research: Dict[str, str],
    relevant: Dict[str, Any],
) -> List[Dict[str, str]]:
    enriched: List[Dict[str, str]] = []
    existing_relevance = next(
        (section.get("content", "") for section in sections if section.get("id") == "relevance"),
        "",
    )
    mapped_relevance = _kb_relevance_summary(account_name, research, relevant, existing_relevance)
    for section in sections:
        if section.get("id") == "relevance":
            enriched.append(
                {
                    "id": "relevance",
                    "title": SUMMARY_SECTION_TITLES["relevance"],
                    "content": mapped_relevance,
                }
            )
        else:
            enriched.append(section)
    return enriched


def _heuristic_artifact_plan(fields: Dict[str, str]) -> List[Dict[str, Any]]:
    industry = fields.get("Industry - PreDC", "the prospect")
    service = fields.get("Campaign Service - PreDC", "discovery")
    return [
        {
            "id": "art-deck",
            "name": f"{service or 'Services'} overview deck",
            "type": "deck",
            "rationale": f"Anchor the conversation for {industry}.",
            "priority": 1,
        },
        {
            "id": "art-case",
            "name": f"{industry} case study",
            "type": "case_study",
            "rationale": "Social proof aligned to their industry.",
            "priority": 2,
        },
        {
            "id": "art-onepager",
            "name": "Service one-pager",
            "type": "one_pager",
            "rationale": "Leave-behind summarizing fit and next steps.",
            "priority": 3,
        },
    ]


def _kb_search(
    ctx: TenantContext,
    query: str,
    limit: int = 5,
) -> Tuple[List[Dict[str, Any]], str]:
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


def _fulfill_artifacts_heuristic(
    plan: List[Dict[str, Any]],
    hits: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in plan:
        name = item.get("name", "Artifact")
        best = hits[0] if hits else None
        if best and float(best.get("score", 0)) >= 0.5:
            out.append(
                {
                    "artifactId": item.get("id", ""),
                    "name": name,
                    "status": "found",
                    "snippet": (best.get("chunk_text") or "")[:280],
                    "assetId": str(best.get("asset_id", "")),
                }
            )
        else:
            out.append(
                {
                    "artifactId": item.get("id", ""),
                    "name": name,
                    "status": "missing",
                    "requiredData": f"Upload or tag KB content for: {name}",
                }
            )
    return out


def _artifact_type_label(value: Any) -> str:
    text = str(value or "content").replace("_", " ").strip()
    return text or "content"


def _artifact_priority(item: Dict[str, Any], fallback: int = 99) -> int:
    try:
        return int(item.get("priority") or fallback)
    except (TypeError, ValueError):
        return fallback


def _build_pre_deck(
    account_name: str,
    research: Dict[str, str],
    plan: List[Dict[str, Any]],
    hits: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build a lightweight previewable pre-call deck for the Pre-DC screen."""
    slides: List[Dict[str, Any]] = []

    def add_slide(
        title: str,
        narrative: str,
        *,
        source_type: str = "workflow",
        asset_id: Optional[str] = None,
        preview_text: Optional[str] = None,
    ) -> None:
        clean = narrative.strip()
        if not clean:
            return
        slides.append(
            {
                "id": f"predeck-{len(slides) + 1}",
                "title": title,
                "narrative": clean[:700],
                "sourceType": source_type,
                "assetId": asset_id,
                "previewText": (preview_text or clean)[:1200],
            }
        )

    context_bits = [
        research.get("company_description", ""),
        research.get("industry", ""),
        research.get("icp_bucket", ""),
        research.get("deal_stage", ""),
    ]
    add_slide(
        "Account context",
        " ".join(bit for bit in context_bits if bit).strip()
        or f"Prepare discovery context for {account_name}.",
    )

    add_slide(
        "Likely need and discovery angle",
        " ".join(
            bit
            for bit in [
                research.get("needs", ""),
                research.get("intersection", ""),
                research.get("campaign_service", ""),
            ]
            if bit
        ),
    )

    for hit in hits[:3]:
        snippet = (hit.get("chunk_text") or "").strip()
        if not snippet:
            continue
        add_slide(
            "Relevant proof point",
            snippet,
            source_type="knowledge_base",
            asset_id=str(hit.get("asset_id", "")) or None,
            preview_text=snippet,
        )

    planned_names = [
        f"{item.get('name', 'Artifact')} ({_artifact_type_label(item.get('type'))})"
        for item in sorted(plan, key=_artifact_priority)[:4]
    ]
    if planned_names:
        add_slide(
            "Recommended talk track",
            "Prepare these assets for the call: " + "; ".join(planned_names) + ".",
        )

    return {
        "title": f"{account_name} pre-call deck",
        "status": "ready" if any(s.get("sourceType") == "knowledge_base" for s in slides) else "needs_content",
        "summary": "Preview deck assembled from Pre-DC research and the strongest KB matches.",
        "slides": slides[:6],
    }


def _content_to_generate(
    plan: List[Dict[str, Any]],
    fulfillments: List[Dict[str, Any]],
    relevant: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    planned_by_id = {str(item.get("id", "")): item for item in plan}
    relevant = relevant or {}
    relevant_projects = _relevant_projects(relevant)[:5]
    relevant_documents = [
        doc for doc in (relevant.get("relevantDocuments") or [])
        if isinstance(doc, dict)
    ][:5]
    recommended_deck = _select_recommended_deck(relevant)
    output: List[Dict[str, Any]] = []
    for row in fulfillments:
        status = str(row.get("status") or "").lower()
        if status not in ("missing", "partial"):
            continue
        artifact_id = str(row.get("artifactId") or "")
        planned = planned_by_id.get(artifact_id, {})
        name = row.get("name") or planned.get("name") or "New content"
        rationale = str(planned.get("rationale") or "").strip()
        required = str(row.get("requiredData") or "").strip()
        reason_parts = []
        if required:
            reason_parts.append(required)
        if rationale:
            reason_parts.append(f"It matters for this call because {rationale}")
        if not reason_parts:
            reason_parts.append(
                "The workflow could not find a strong enough knowledge-base match for this planned call asset."
            )
        reason = " ".join(reason_parts)
        item: Dict[str, Any] = {
            "id": f"gap-{artifact_id or len(output) + 1}",
            "sourceArtifactId": artifact_id or None,
            "name": name,
            "type": planned.get("type") or "one_pager",
            "priority": _artifact_priority(planned, len(output) + 1),
            "status": status,
            "reason": reason,
            "neededFor": rationale
            or "Give the pod stronger call-specific material than the current KB can provide.",
        }
        if relevant_projects:
            item["relevantProjects"] = relevant_projects
        if relevant_documents:
            item["relevantDocuments"] = relevant_documents
        if recommended_deck:
            item["recommendedDeck"] = recommended_deck
        evidence: List[Dict[str, Any]] = []
        for project in relevant_projects[:3]:
            evidence.append(
                {
                    "sourceType": str(project.get("source") or "project_database"),
                    "sourceId": str(project.get("id") or ""),
                    "assetId": project.get("assetId"),
                    "title": str(project.get("title") or "Relevant project"),
                    "summary": str(project.get("summary") or ""),
                    "details": str(project.get("details") or ""),
                    "relevanceScore": project.get("relevanceScore"),
                }
            )
        for doc in relevant_documents[:3]:
            evidence.append(
                {
                    "sourceType": "knowledge_base",
                    "sourceId": str(doc.get("assetId") or ""),
                    "assetId": doc.get("assetId"),
                    "title": str(doc.get("title") or "Relevant KB document"),
                    "summary": str(doc.get("snippet") or doc.get("previewText") or ""),
                    "relevanceScore": doc.get("relevanceScore"),
                }
            )
        if evidence:
            item["evidence"] = evidence
        output.append(item)
    output.sort(key=lambda item: _artifact_priority(item))
    return output


def _is_presentation_document(doc: Dict[str, Any]) -> bool:
    fmt = str(doc.get("format") or "").lower()
    file_name = str(doc.get("fileName") or doc.get("file_name") or "").lower()
    mime = str(doc.get("mimeType") or doc.get("mime_type") or "").lower()
    return (
        fmt in ("ppt", "pptx")
        or file_name.endswith((".ppt", ".pptx"))
        or "presentation" in mime
        or "powerpoint" in mime
    )


def _select_recommended_deck(relevant: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    documents = relevant.get("relevantDocuments") or []
    for doc in documents:
        if isinstance(doc, dict) and _is_presentation_document(doc):
            return doc
    return None


def run_pre_dc_pipeline(
    ctx: TenantContext,
    call_id: str,
    account_name: str,
    fields: Dict[str, str],
    trigger: str = "ingest",
) -> AgentEnvelope:
    settings = get_settings()
    cfg_repo = get_agent_config_repository()
    cfg = cfg_repo.get_config(ctx, "workflow")
    model_policy = cfg.get("model_policy") or {}
    research = research_from_fields(fields)

    summary_prompt = resolve_prompt(cfg, "summary", "workflow/summary/v1.0.0.md")
    plan_prompt = resolve_prompt(cfg, "artifact_plan", "workflow/artifact_plan/v1.0.0.md")
    fulfill_prompt = resolve_prompt(cfg, "artifact_fulfill", "workflow/artifact_fulfill/v1.0.0.md")

    llm = LlmClient(openai_api_key=settings.openai_api_key or None)
    model = model_policy.get("model_name") or "gpt-5.4-mini"
    fallback = model_policy.get("fallback_model_name") or "gpt-5.4-mini"

    fields_blob = json.dumps(fields, ensure_ascii=False)
    total_tokens = 0
    total_cost = 0.0
    trace_id = str(uuid.uuid4())
    model_used = "heuristic"
    summary_sections: List[Dict[str, str]] = []

    if settings.openai_configured:
        summary_user = f"Account: {account_name}\nCall ID: {call_id}\nTrigger: {trigger}\nCSV row:\n{fields_blob}"
        summary_completion = llm.complete(
            system=summary_prompt,
            user=summary_user,
            model=model,
            fallback_model=fallback,
        )
        summary_json = _extract_json_block(summary_completion.text)
        summary_sections = _normalize_summary_sections(summary_json)
        ai_summary = (
            "\n\n".join(section["content"] for section in summary_sections)
            if summary_sections
            else summary_completion.text.strip()
        )
        total_tokens += summary_completion.tokens_in + summary_completion.tokens_out
        total_cost += summary_completion.cost_usd
        trace_id = summary_completion.trace_id
        model_used = summary_completion.model

        plan_user = f"Account: {account_name}\nCSV row:\n{fields_blob}"
        plan_completion = llm.complete(
            system=plan_prompt,
            user=plan_user,
            model=model,
            fallback_model=fallback,
        )
        plan_json = _extract_json_block(plan_completion.text) or {}
        artifact_plan = plan_json.get("artifacts") or _heuristic_artifact_plan(fields)
        total_tokens += plan_completion.tokens_in + plan_completion.tokens_out
        total_cost += plan_completion.cost_usd
    else:
        ai_summary = _heuristic_summary(fields, account_name)
        artifact_plan = _heuristic_artifact_plan(fields)

    kb_query = f"{account_name} {research.get('needs', '')} {research.get('campaign_service', '')}"
    hits, _ = _kb_search(ctx, kb_query, limit=6)

    fulfillments: List[Dict[str, Any]] = []
    if settings.openai_configured and artifact_plan:
        per_artifact_hits: List[Dict[str, Any]] = []
        for art in artifact_plan[:6]:
            art_hits, _ = _kb_search(
                ctx,
                f"{account_name} {art.get('name', '')} {art.get('type', '')}",
                limit=3,
            )
            per_artifact_hits.append({"artifact": art, "hits": art_hits})

        fulfill_user = json.dumps(
            {"account": account_name, "planned": artifact_plan, "kb_by_artifact": per_artifact_hits},
            ensure_ascii=False,
        )
        fulfill_completion = llm.complete(
            system=fulfill_prompt,
            user=fulfill_user,
            model=model,
            fallback_model=fallback,
        )
        fulfill_json = _extract_json_block(fulfill_completion.text) or {}
        fulfillments = fulfill_json.get("fulfillment") or _fulfill_artifacts_heuristic(artifact_plan, hits)
        total_tokens += fulfill_completion.tokens_in + fulfill_completion.tokens_out
        total_cost += fulfill_completion.cost_usd
    else:
        fulfillments = _fulfill_artifacts_heuristic(artifact_plan, hits)

    relevant = build_relevant_content(ctx, account_name, research)
    pre_deck = _build_pre_deck(account_name, research, artifact_plan, hits)
    content_to_generate = _content_to_generate(artifact_plan, fulfillments, relevant)

    citations: List[Citation] = []
    for i, hit in enumerate(hits[:3]):
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or "")[:200],
                confidence=float(hit.get("score", 0.85)),
            )
        )
    crm_snippet = (
        research.get("company_description")
        or research.get("needs")
        or research.get("intersection")
        or research.get("industry")
        or account_name
    )
    if crm_snippet:
        citations.append(
            Citation(
                source_type="crm_record",
                source_id=call_id,
                snippet=crm_snippet[:200],
                confidence=0.9,
            )
        )

    icp_bucket = research.get("icp_bucket", "")
    icp_match = 0.75
    if icp_bucket:
        b = icp_bucket.lower()
        if "enterprise" in b or "desirable" in b:
            icp_match = 0.88
        elif "sweet" in b:
            icp_match = 0.78
        elif "potential" in b:
            icp_match = 0.62

    summary_sections = _complete_summary_sections(summary_sections, fields, account_name)
    summary_sections = _enrich_customer_profile_section(summary_sections, fields, account_name)
    summary_sections = _enrich_customer_pain_points_section(summary_sections, fields)
    summary_sections = _enrich_relevance_section(
        summary_sections,
        account_name=account_name,
        research=research,
        relevant=relevant,
    )
    summary_sections = canonicalize_summary_section_titles(summary_sections)
    ai_summary = "\n\n".join(section["content"] for section in summary_sections)
    recommended_deck = _select_recommended_deck(relevant)
    recommended_deck_slides = (
        [
            {
                "id": recommended_deck.get("assetId", "recommended-deck"),
                "title": recommended_deck.get("title", "Recommended deck"),
                "usedInCalls": 0,
                "progressedIn": 0,
                "included": True,
            }
        ]
        if recommended_deck
        else []
    )

    result: Dict[str, Any] = {
        "callId": call_id,
        "accountName": account_name,
        "aiSummary": ai_summary,
        "summarySections": summary_sections,
        "dealStage": research.get("deal_stage", "Discovery"),
        "daysSinceLastContact": 0,
        "icpMatch": icp_match,
        "icpNote": icp_bucket or None,
        "newSignals": [research.get("other", "")] if research.get("other") else [],
        "pains": [
            {
                "text": _business_need_text(research.get("needs", ""), allow_plain=True)
                or _pain_point_text(research.get("intersection", ""), allow_plain=True)
                or NEEDS_CONTENT_FALLBACK,
                "confidence": 0.8,
            }
        ],
        "objections": [],
        "discovery_questions": [
            f"What does success look like for {account_name} in the next 90 days?",
        ],
        "deckSlides": recommended_deck_slides,
        "clientAttendees": [],
        "interactionHistory": [],
        "podNotes": [],
        "preDeck": pre_deck,
        "artifactPlan": artifact_plan,
        "artifactFulfillment": fulfillments,
        "contentToGenerate": content_to_generate,
        "relevantDocuments": relevant.get("relevantDocuments") or [],
        "relevantProjects": relevant.get("relevantProjects") or [],
        "recommendedDeck": recommended_deck,
        "agentStatus": "success",
    }

    envelope = AgentEnvelope(
        agent="workflow",
        operation="workflow_pipeline",
        result=result,
        citations=citations,
        confidence=0.82,
        cost={"tokens": total_tokens, "usd": total_cost, "model": model_used},
        trace_id=trace_id,
    )
    validate_envelope(envelope)
    return envelope
