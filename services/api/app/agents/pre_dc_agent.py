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
) -> List[Dict[str, Any]]:
    planned_by_id = {str(item.get("id", "")): item for item in plan}
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
        output.append(
            {
                "id": f"gap-{artifact_id or len(output) + 1}",
                "sourceArtifactId": artifact_id or None,
                "name": name,
                "type": planned.get("type") or "one_pager",
                "priority": _artifact_priority(planned, len(output) + 1),
                "status": status,
                "reason": " ".join(reason_parts),
                "neededFor": rationale
                or "Give the pod stronger call-specific material than the current KB can provide.",
            }
        )
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

    llm = LlmClient(api_key=settings.anthropic_api_key or None)
    model = model_policy.get("model_name") or "claude-sonnet-4-6"
    fallback = model_policy.get("fallback_model_name") or "claude-sonnet-4-6"

    fields_blob = json.dumps(fields, ensure_ascii=False)
    total_tokens = 0
    total_cost = 0.0
    trace_id = str(uuid.uuid4())
    model_used = "heuristic"

    if settings.anthropic_configured:
        summary_user = f"Account: {account_name}\nCall ID: {call_id}\nTrigger: {trigger}\nCSV row:\n{fields_blob}"
        summary_completion = llm.complete(
            system=summary_prompt,
            user=summary_user,
            model=model,
            fallback_model=fallback,
        )
        ai_summary = summary_completion.text.strip()
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
    if settings.anthropic_configured and artifact_plan:
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

    pre_deck = _build_pre_deck(account_name, research, artifact_plan, hits)
    content_to_generate = _content_to_generate(artifact_plan, fulfillments)

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

    relevant = build_relevant_content(ctx, account_name, research)
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
        "dealStage": research.get("deal_stage", "Discovery"),
        "daysSinceLastContact": 0,
        "icpMatch": icp_match,
        "icpNote": icp_bucket or None,
        "newSignals": [research.get("other", "")] if research.get("other") else [],
        "pains": [{"text": research.get("needs", "Discovery needed"), "confidence": 0.8}],
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
