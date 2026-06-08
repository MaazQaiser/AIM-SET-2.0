from __future__ import annotations

import json
import html as html_lib
import re
import uuid
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Set, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.config import get_settings
from app.domain.agent_runtime import get_content_generation_runtime
from app.domain.content_studio_guardrails import (
    check_project_cost_ceiling,
    sanitize_html,
    strip_secrets,
    validate_citations_in_html,
    validate_deck_slide_count,
    validate_user_input,
)
from app.domain.content_studio_repository import ContentStudioRepository, get_content_studio_repository
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.services.deck_assembly_service import (
    merge_slide_plan_to_html,
    slide_plan_to_outline,
)

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"


def load_prompt(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "You are the Content Generation Agent."


def _extract_block(text: str, tag: str) -> Optional[str]:
    pattern = rf"<{tag}[^>]*>(.*?)</{tag}>"
    m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else None


def _extract_html_block(text: str) -> Tuple[Optional[str], Optional[str]]:
    m = re.search(r'<html\s+template_id="([^"]+)"[^>]*>(.*?)</html>', text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1), m.group(2).strip()
    inner = _extract_block(text, "html")
    return None, inner


def _parse_patch(text: str) -> Optional[Dict[str, Any]]:
    m = re.search(r'<patch\s+slide="(\d+)"[^>]*>(.*?)</patch>', text, re.DOTALL | re.IGNORECASE)
    if not m:
        return None
    return {"slide": int(m.group(1)), "html": m.group(2).strip()}


def _parse_template_recommendations(text: str) -> List[Dict[str, str]]:
    block = _extract_block(text, "recommend-templates")
    if not block:
        return []
    try:
        data = json.loads(block)
        if isinstance(data, list):
            return [
                {"template_id": str(x.get("template_id", "")), "rationale": str(x.get("rationale", ""))}
                for x in data
                if x.get("template_id")
            ]
    except json.JSONDecodeError:
        pass
    return []


def _parse_json_turn(text: str) -> Optional[Dict[str, Any]]:
    raw = text.strip()
    if not raw.startswith("{"):
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    if "turn_type" not in data:
        return None
    return data


def _hits_to_citations(hits: List[Dict[str, Any]]) -> List[Citation]:
    citations: List[Citation] = []
    for i, hit in enumerate(hits[:5]):
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or "")[:200],
                confidence=float(hit.get("score", 0.85)),
            )
        )
    return citations


def _retrieve_studio_evidence(
    ctx: TenantContext,
    *,
    project: Dict[str, Any],
    brief: Dict[str, Any],
    user_message: str,
    settings: Any,
) -> Tuple[List[Dict[str, Any]], List[Citation]]:
    kb_repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    query = f"{project.get('title', '')} {user_message} {json.dumps(brief)}"

    def vector_search(_tid: str, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        return kb_repo.match_chunks(tenant_uuid, embedding, limit=limit, clerk_key=clerk_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    from app.domain.memory_store import get_memory_store

    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=5,
        chunks=get_memory_store().kb_chunks.get(clerk_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )
    return hits, _hits_to_citations(hits)


def _attach_outline_sources(
    outline: List[Dict[str, Any]],
    *,
    project_id: str,
    kb_hits: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not outline:
        return outline
    out: List[Dict[str, Any]] = []
    kb_sources = [f"kb:{hit.get('asset_id')}" for hit in kb_hits if hit.get("asset_id")]
    for index, item in enumerate(outline):
        if not isinstance(item, dict):
            continue
        next_item = dict(item)
        if kb_sources:
            if not next_item.get("citation_source"):
                next_item["citation_source"] = kb_sources[index % len(kb_sources)]
            snippet = str(kb_hits[index % len(kb_hits)].get("chunk_text") or "").strip()
            if snippet and not next_item.get("evidence"):
                next_item["evidence"] = snippet[:180]
        elif not next_item.get("citation_source"):
            next_item["citation_source"] = f"session:{project_id}"
        out.append(next_item)
    return out


def _brief_citations(project_id: str, brief: Dict[str, Any]) -> List[Citation]:
    snippets = []
    for key in ("audience", "content_context", "style", "content_requirements", "source_path"):
        value = str(brief.get(key) or "").strip()
        if value:
            snippets.append(f"{key}: {value}")
    points = brief.get("pain_points_coverage") or brief.get("key_points")
    if isinstance(points, list):
        snippets.extend(str(point).strip() for point in points if str(point).strip())
    return [
        Citation(
            source_type="studio_brief",
            source_id=project_id,
            snippet="; ".join(snippets)[:200],
            confidence=0.7,
        )
    ]


def _float_or(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _suggestion_plan_citations(brief: Dict[str, Any]) -> List[Citation]:
    plan = _get_suggestion_plan(brief)
    if not plan:
        return []
    evidence = plan.get("evidence") or {}
    citations: List[Citation] = []
    for project in (evidence.get("projects") or [])[:5]:
        if not isinstance(project, dict):
            continue
        source_id = str(project.get("asset_id") or project.get("source_project_id") or "").strip()
        snippet = str(project.get("snippet") or project.get("details") or project.get("title") or "").strip()
        if not source_id and not snippet:
            continue
        citations.append(
            Citation(
                source_type="project_database",
                source_id=source_id or str(project.get("title") or "project"),
                snippet=snippet[:200],
                confidence=_float_or(project.get("score"), 0.8),
            )
        )
    for kb in (evidence.get("kb_assets") or [])[:5]:
        if not isinstance(kb, dict):
            continue
        source_id = str(kb.get("asset_id") or "").strip()
        snippet = str(kb.get("snippet") or kb.get("title") or "").strip()
        if not source_id and not snippet:
            continue
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=source_id or str(kb.get("title") or "kb-document"),
                snippet=snippet[:200],
                confidence=_float_or(kb.get("score"), 0.85),
            )
        )
    return citations


def _dedupe_citations(citations: List[Citation]) -> List[Citation]:
    seen: set[tuple[str, str]] = set()
    out: List[Citation] = []
    for citation in citations:
        key = (citation.source_type, citation.source_id)
        if key in seen:
            continue
        seen.add(key)
        out.append(citation)
    return out


def _get_suggestion_plan(brief: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    plan = brief.get("suggestion_plan")
    return plan if isinstance(plan, dict) else None


def _get_slide_plan(brief: Dict[str, Any]) -> List[Dict[str, Any]]:
    plan = _get_suggestion_plan(brief)
    if plan and isinstance(plan.get("slide_plan"), list):
        return [item for item in plan["slide_plan"] if isinstance(item, dict)]
    outline = brief.get("slide_outline")
    if isinstance(outline, list):
        return [item for item in outline if isinstance(item, dict)]
    return []


def _sync_slide_plan_to_brief(brief: Dict[str, Any], slide_plan: List[Dict[str, Any]]) -> Dict[str, Any]:
    b = dict(brief)
    b["slide_outline"] = slide_plan_to_outline(slide_plan)
    b["slide_count"] = len(slide_plan) or b.get("slide_count")
    plan = _get_suggestion_plan(b)
    if plan:
        plan = dict(plan)
        plan["slide_plan"] = slide_plan
        b["suggestion_plan"] = plan
    return b


def _generate_deck_from_plan(
    ctx: TenantContext,
    *,
    project_id: str,
    project: Dict[str, Any],
    brief: Dict[str, Any],
    clean_msg: str,
    template_id: Optional[str],
    repo: ContentStudioRepository,
    settings: Any,
    runtime: Dict[str, Any],
) -> AgentEnvelope:
    """Generate deck HTML from suggestion_plan: reuse slides + LLM for generate modes."""
    tpl_id = template_id or project.get("templateId")
    chosen_template = repo.get_template(ctx, tpl_id) if tpl_id else None
    title = str(project.get("title") or "Generated Deck")

    slide_plan = _get_slide_plan(brief)
    if not slide_plan:
        brief = _brief_with_defaults(brief)
        slide_plan = _get_slide_plan(brief) or _build_slide_outline(title=title, brief=brief)

    kb_hits, citations = _retrieve_studio_evidence(
        ctx,
        project=project,
        brief=brief,
        user_message=clean_msg,
        settings=settings,
    )
    citations = _dedupe_citations([*_suggestion_plan_citations(brief), *citations])
    if not citations:
        citations = _brief_citations(project_id, brief)

    generated_sections: Dict[int, str] = {}
    slides_to_generate = [
        item for item in slide_plan
        if isinstance(item, dict) and str(item.get("mode") or "generate").lower() in ("generate", "hybrid")
    ]

    if slides_to_generate and settings.openai_configured:
        suggestion_plan = _get_suggestion_plan(brief) or {}
        template_context = _template_context(chosen_template)
        system = runtime["system_prompt"]
        gen_payload = json.dumps(
            {
                "title": title,
                "brief": brief,
                "suggestion_plan": suggestion_plan,
                "slides_to_generate": slides_to_generate,
                "kb_hits": kb_hits[:5],
                "template_css": (chosen_template or {}).get("cssVariables", {}),
                "template_context": template_context,
            },
            indent=2,
        )
        try:
            completion = LlmClient(openai_api_key=settings.openai_api_key or None).complete(
                system=system,
                user=(
                    "Generate ONLY the slides listed in slides_to_generate. "
                    "Return each as <section class=\"slide\" data-slide=\"N\">...</section> "
                    "inside a single <html> block. Ground claims in kb_hits.\n\n"
                    + gen_payload
                ),
                max_tokens=4096,
                model=runtime["model_name"],
                fallback_model=runtime["fallback_model_name"],
            )
            _, html_body = _extract_html_block(completion.text)
            if html_body:
                pattern = re.compile(
                    r'(<section[^>]*\bdata-slide=["\']?(\d+)["\']?[^>]*>.*?</section>)',
                    re.DOTALL | re.IGNORECASE,
                )
                for match in pattern.finditer(html_body):
                    generated_sections[int(match.group(2))] = match.group(1)
        except Exception:
            pass

    if not generated_sections:
        for item in slides_to_generate:
            if not isinstance(item, dict):
                continue
            slide_num = int(item.get("slide") or 0)
            partial_html = _build_slide_preview_html(title=title, brief={"slide_outline": [item]}, template=chosen_template)
            section = extract_slide_section(partial_html, slide_num)
            if section:
                generated_sections[slide_num] = section

    full_html = merge_slide_plan_to_html(
        ctx,
        title=title,
        slide_plan=slide_plan,
        template=chosen_template,
        generated_sections=generated_sections,
        repo=repo,
        artifact_type="deck",
    )

    _, violations = sanitize_html(full_html)
    if violations:
        raise ValueError(f"HTML guardrail violations: {violations}")
    deck_err = validate_deck_slide_count(full_html, "deck")
    if deck_err:
        raise ValueError(deck_err)

    rev = repo.create_revision(
        ctx,
        project_id,
        html=full_html,
        citations=[c.model_dump() for c in citations],
        template_id=tpl_id,
    )
    brief = _sync_slide_plan_to_brief(brief, slide_plan)
    patch: Dict[str, Any] = {"brief": brief, "status": "preview"}
    if tpl_id:
        patch["templateId"] = tpl_id
    repo.update_project(ctx, project_id, patch)

    reuse_count = sum(1 for s in slide_plan if isinstance(s, dict) and str(s.get("mode")) == "reuse")
    gen_count = len(slide_plan) - reuse_count
    message = (
        f"Draft ready: {gen_count} generated slide{'s' if gen_count != 1 else ''}, "
        f"{reuse_count} reused from KB. Tell me which slide to edit from chat."
    )

    envelope = AgentEnvelope(
        agent="content_generation",
        operation="html_generate",
        result={
            "project_id": project_id,
            "turn_type": "html",
            "message": message,
            "revision_id": rev["id"],
            "html": full_html,
            "template_id": tpl_id,
            "slide_plan": slide_plan,
        },
        citations=citations,
        confidence=0.9 if kb_hits else 0.78,
        cost={"tokens": 0, "usd": 0.0, "model": "deck-plan-assembly"},
        trace_id=str(uuid.uuid4()),
        creative=bool(slides_to_generate),
    )
    validate_envelope(envelope)
    return envelope


def extract_slide_section(html: str, slide_index: int) -> Optional[str]:
    from app.services.deck_assembly_service import extract_slide_section as _extract

    return _extract(html, slide_index)


def run_studio_bootstrap(
    ctx: TenantContext,
    *,
    project_id: str,
    repo: Optional[ContentStudioRepository] = None,
) -> AgentEnvelope:
    """Proactively seed chat from a content suggestion: brief, slide plan, template, KB hits."""
    repo = repo or get_content_studio_repository()
    project = repo.get_project(ctx, project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    title = str(project.get("title") or "Generated content")
    artifact_type = str(project.get("artifactType") or "deck")
    brief = _normalize_brief(project.get("brief"))
    brief["artifact_type"] = artifact_type
    brief = _enrich_brief_from_suggestion(brief, title, artifact_type)

    suggestion_plan = _get_suggestion_plan(brief)
    if suggestion_plan:
        evidence = suggestion_plan.get("evidence") or {}
        kb_ids = []
        for kb in (evidence.get("kb_assets") or []):
            if isinstance(kb, dict) and kb.get("asset_id"):
                kb_ids.append(str(kb["asset_id"]))
        if kb_ids:
            brief["kb_asset_ids"] = kb_ids[:8]
        slide_plan = suggestion_plan.get("slide_plan")
        if isinstance(slide_plan, list) and slide_plan:
            brief["slide_outline"] = slide_plan_to_outline(slide_plan)
            brief["slide_count"] = len(slide_plan)
        tpl = suggestion_plan.get("template") or {}
        template_id_from_plan = str(tpl.get("template_id") or "").strip()
    else:
        template_id_from_plan = ""

    from concurrent.futures import ThreadPoolExecutor
    bootstrap_query = f"{title} {brief.get('needed_for', '')} {brief.get('generation_reason', '')}"
    with ThreadPoolExecutor(max_workers=2) as pool:
        kb_future = pool.submit(_retrieve_studio_kb_hits, ctx, bootstrap_query)
        tpl_future = pool.submit(_pick_default_templates, ctx, repo, project, brief, title)
        kb_hits = kb_future.result()
        best_template, recommendations = tpl_future.result()

    if kb_hits and not brief.get("kb_asset_ids"):
        brief["kb_asset_ids"] = [str(hit.get("asset_id", "")) for hit in kb_hits[:5] if hit.get("asset_id")]

    if artifact_type == "deck" and _needs_slide_outline(brief, artifact_type) and not brief.get("slide_outline"):
        _existing_tpl_id = str(project.get("templateId") or template_id_from_plan or "").strip()
        _existing_tpl = repo.get_template(ctx, _existing_tpl_id) if _existing_tpl_id else None
        brief["slide_outline"] = _build_slide_outline(
            title=title, brief=brief, two_sections=_template_has_two_sections(_existing_tpl)
        )
        brief["slide_outline"] = _attach_outline_sources(
            brief["slide_outline"],
            project_id=project_id,
            kb_hits=kb_hits,
        )
    elif artifact_type == "deck" and brief.get("slide_outline") and kb_hits:
        brief["slide_outline"] = _attach_outline_sources(
            brief["slide_outline"],
            project_id=project_id,
            kb_hits=kb_hits,
        )
    if template_id_from_plan:
        planned = repo.get_template(ctx, template_id_from_plan)
        if planned:
            best_template = planned
            if not any(r.get("template_id") == template_id_from_plan for r in recommendations):
                recommendations = [
                    {
                        "template_id": template_id_from_plan,
                        "rationale": str((suggestion_plan or {}).get("template", {}).get("rationale") or ""),
                    },
                    *recommendations,
                ]
    patch: Dict[str, Any] = {"brief": brief}
    if best_template:
        patch["templateId"] = best_template["id"]
        patch["recommendedTemplateIds"] = [r["template_id"] for r in recommendations]
    repo.update_project(ctx, project_id, patch)

    message = _bootstrap_message(
        brief=brief,
        artifact_type=artifact_type,
        template_name=str((best_template or {}).get("name") or ""),
        kb_hits=kb_hits,
        suggestion_plan=suggestion_plan,
    )
    result: Dict[str, Any] = {
        "project_id": project_id,
        "turn_type": "outline",
        "message": message,
    }
    if brief.get("slide_outline"):
        result["slide_outline"] = brief["slide_outline"]
    if suggestion_plan and suggestion_plan.get("slide_plan"):
        result["slide_plan"] = suggestion_plan["slide_plan"]
        result["suggestion_plan"] = suggestion_plan
    if recommendations:
        result["recommended_templates"] = recommendations
    if best_template:
        result["template_id"] = best_template["id"]
    if kb_hits:
        result["kb_matches"] = _kb_matches_payload(kb_hits)

    envelope = AgentEnvelope(
        agent="content_generation",
        operation="studio_bootstrap",
        result=result,
        citations=_dedupe_citations([*_suggestion_plan_citations(brief), *_hits_to_citations(kb_hits)]),
        confidence=0.9,
        cost={"tokens": 0, "usd": 0.0, "model": "rule-based-bootstrap"},
        trace_id=str(uuid.uuid4()),
        creative=True,
    )
    validate_envelope(envelope)
    return envelope


def run_studio_turn(
    ctx: TenantContext,
    *,
    project_id: str,
    user_message: str,
    template_id: Optional[str] = None,
    allow_generation: bool = False,
    repo: Optional[ContentStudioRepository] = None,
) -> AgentEnvelope:
    creative_mode = False
    settings = get_settings()
    repo = repo or get_content_studio_repository()
    runtime = get_content_generation_runtime(ctx)
    project = repo.get_project(ctx, project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    clean_msg = strip_secrets(user_message)
    validate_user_input(clean_msg, project_id)
    check_project_cost_ceiling(
        float(project.get("costUsd", 0)),
        float(runtime["per_run_ceiling_usd"]),
        project_ceiling_usd=float(runtime["project_ceiling_usd"]),
    )
    brief = _normalize_brief(project.get("brief"))
    artifact_type = str(project.get("artifactType") or brief.get("artifact_type") or "deck")
    brief["artifact_type"] = artifact_type
    title = str(project.get("title") or "Generated content")

    if _has_suggestion_context(brief):
        enriched = _enrich_brief_from_suggestion(brief, title, artifact_type)
        if enriched != brief:
            brief = enriched
            repo.update_project(ctx, project_id, {"brief": brief})

    if clean_msg and _is_kb_content_question(clean_msg):
        kb_hits = _retrieve_studio_kb_hits(
            ctx,
            f"{title} {clean_msg} {brief.get('needed_for', '')} {brief.get('generation_reason', '')}",
        )
        envelope = AgentEnvelope(
            agent="content_generation",
            operation="studio_kb_lookup",
            result={
                "project_id": project_id,
                "turn_type": "outline" if brief.get("slide_outline") else "ask",
                "message": _kb_lookup_message(kb_hits, brief),
                "slide_outline": brief.get("slide_outline") or [],
                "kb_matches": _kb_matches_payload(kb_hits),
            },
            citations=_hits_to_citations(kb_hits),
            confidence=0.85 if kb_hits else 0.6,
            cost={"tokens": 0, "usd": 0.0, "model": "rule-based-kb-lookup"},
            trace_id=str(uuid.uuid4()),
            creative=True,
        )
        validate_envelope(envelope)
        return envelope

    if not allow_generation:
        updated = _update_brief_from_reply(brief, clean_msg)
        if updated != brief:
            brief = updated
            repo.update_project(ctx, project_id, {"brief": brief})
        missing = _missing_brief_fields(brief)
        if missing:
            envelope = AgentEnvelope(
                agent="content_generation",
                operation="studio_ask",
                result={
                    "project_id": project_id,
                    "turn_type": "ask",
                    "ask": _questions_for_missing(
                        missing,
                        artifact_type=str(project.get("artifactType") or "deck"),
                    ),
                },
                citations=[],
                confidence=0.75,
                cost={"tokens": 0, "usd": 0.0, "model": "rule-based-brief-capture"},
                trace_id=str(uuid.uuid4()),
                creative=True,
            )
            validate_envelope(envelope)
            return envelope

        if _needs_slide_outline(brief, str(project.get("artifactType") or "deck")):
            _tpl_for_outline = repo.get_template(ctx, template_id) if template_id else None
            if not _tpl_for_outline:
                _existing_tpl_id = str(project.get("templateId") or "").strip()
                _tpl_for_outline = repo.get_template(ctx, _existing_tpl_id) if _existing_tpl_id else None
            brief["slide_outline"] = _build_slide_outline(
                title=str(project.get("title") or "Generated Deck"),
                brief=brief,
                two_sections=_template_has_two_sections(_tpl_for_outline),
            )
            best_template, recommendations = _pick_default_templates(
                ctx, repo, project, brief, title
            )
            patch: Dict[str, Any] = {"brief": brief}
            if best_template and not project.get("templateId"):
                patch["templateId"] = best_template["id"]
                patch["recommendedTemplateIds"] = [r["template_id"] for r in recommendations]
            repo.update_project(ctx, project_id, patch)
            message = (
                _bootstrap_message(
                    brief=brief,
                    artifact_type=artifact_type,
                    template_name=str((best_template or {}).get("name") or ""),
                    kb_hits=[],
                )
                if _has_suggestion_context(brief)
                else "Here is the proposed slide plan. Tell me what to change on any slide, or click Generate when it looks right."
            )
            envelope = AgentEnvelope(
                agent="content_generation",
                operation="studio_ask",
                result={
                    "project_id": project_id,
                    "turn_type": "outline",
                    "message": message,
                    "slide_outline": brief["slide_outline"],
                    "recommended_templates": recommendations or None,
                    "template_id": (best_template or {}).get("id"),
                },
                citations=[],
                confidence=0.8,
                cost={"tokens": 0, "usd": 0.0, "model": "rule-based-slide-plan"},
                trace_id=str(uuid.uuid4()),
                creative=True,
            )
            validate_envelope(envelope)
            return envelope

        if _is_slide_outline_edit(clean_msg, brief):
            latest = repo.latest_revision(ctx, project_id)
            if latest:
                patch_citations = latest.get("citations") or [c.model_dump() for c in _brief_citations(project_id, brief)]
                full_html = _build_slide_preview_html(
                    title=str(project.get("title") or "Generated Deck"),
                    brief=brief,
                )
                _, violations = sanitize_html(full_html)
                if violations:
                    raise ValueError(f"HTML guardrail violations: {violations}")
                deck_err = validate_deck_slide_count(full_html, str(project.get("artifactType") or "deck"))
                if deck_err:
                    raise ValueError(deck_err)
                rev = repo.create_revision(
                    ctx,
                    project_id,
                    html=full_html,
                    citations=patch_citations,
                    template_id=project.get("templateId"),
                )
                repo.update_project(ctx, project_id, {"brief": brief, "status": "preview"})
                slide_num = _slide_number_from_text(clean_msg)
                envelope = AgentEnvelope(
                    agent="content_generation",
                    operation="html_patch",
                    result={
                        "project_id": project_id,
                        "turn_type": "patch",
                        "message": (
                            f"Updated slide {slide_num} and refreshed the preview."
                            if slide_num
                            else "Updated the slide and refreshed the preview."
                        ),
                        "revision_id": rev["id"],
                        "html": full_html,
                        "patch": {"slide": slide_num} if slide_num else {},
                        "slide_outline": brief.get("slide_outline") or [],
                    },
                    citations=[Citation(**c) if isinstance(c, dict) else c for c in patch_citations],
                    confidence=0.85,
                    cost={"tokens": 0, "usd": 0.0, "model": "rule-based-slide-editor"},
                    trace_id=str(uuid.uuid4()),
                    creative=False,
                )
                validate_envelope(envelope)
                return envelope

        if str(project.get("artifactType") or "deck") == "deck" and "slide" in clean_msg.lower():
            updated = _update_brief_from_reply(brief, clean_msg)
            if updated != brief:
                brief = updated
                repo.update_project(ctx, project_id, {"brief": brief})
            slide_plan = _get_slide_plan(brief)
            envelope = AgentEnvelope(
                agent="content_generation",
                operation="studio_ask",
                result={
                    "project_id": project_id,
                    "turn_type": "outline",
                    "message": "Updated the slide plan. Tell me any other slide edits, or click Generate when it looks right.",
                    "slide_outline": brief.get("slide_outline") or [],
                    "slide_plan": slide_plan,
                    "suggestion_plan": _get_suggestion_plan(brief),
                },
                citations=[],
                confidence=0.8,
                cost={"tokens": 0, "usd": 0.0, "model": "rule-based-slide-plan"},
                trace_id=str(uuid.uuid4()),
                creative=True,
            )
            validate_envelope(envelope)
            return envelope

        envelope = AgentEnvelope(
            agent="content_generation",
            operation="studio_ask",
            result={
                "project_id": project_id,
                "turn_type": "ask",
                "ask": ["Requirements captured. Click Generate to create the first draft."],
            },
            citations=[],
            confidence=0.8,
            cost={"tokens": 0, "usd": 0.0, "model": "rule-based-brief-capture"},
            trace_id=str(uuid.uuid4()),
            creative=True,
        )
        validate_envelope(envelope)
        return envelope

    # Generate mode: use captured brief and fill safe defaults if still incomplete.
    brief = _brief_with_defaults(brief)
    repo.update_project(ctx, project_id, {"brief": brief})

    if str(project.get("artifactType") or "deck") == "deck":
        return _generate_deck_from_plan(
            ctx,
            project_id=project_id,
            project=project,
            brief=brief,
            clean_msg=clean_msg,
            template_id=template_id,
            repo=repo,
            settings=settings,
            runtime=runtime,
        )

    kb_repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    query = f"{project.get('title', '')} {clean_msg} {json.dumps(brief)}"

    def vector_search(tid: str, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        return kb_repo.match_chunks(tenant_uuid, embedding, limit=limit, clerk_key=clerk_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    from app.domain.memory_store import get_memory_store

    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=5,
        chunks=get_memory_store().kb_chunks.get(clerk_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )
    citations = _hits_to_citations(hits)

    templates = repo.list_templates(ctx, artifact_type=project.get("artifactType"))
    messages = repo.list_messages(ctx, project_id)
    history_lines = []
    for msg in messages[-12:]:
        role = msg.get("role", "user")
        content = msg.get("content") or {}
        text = content.get("text") or json.dumps(content)
        history_lines.append(f"{role}: {text}")

    chosen_template = None
    tpl_id = template_id or project.get("templateId")
    if tpl_id:
        chosen_template = repo.get_template(ctx, tpl_id)
    template_context = _template_context(chosen_template)

    system = runtime["system_prompt"]
    user_payload = (
        f"Project: {project.get('title')}\n"
        f"Artifact type: {project.get('artifactType')}\n"
        f"Brief: {json.dumps(brief)}\n"
        f"Template selected: {tpl_id or 'none'}\n"
        f"Template CSS variables: {(chosen_template or {}).get('cssVariables', {})}\n"
        f"Template HTML/CSS context: {template_context}\n"
        f"Available templates: {json.dumps([{'id': t['id'], 'name': t['name'], 'type': t['artifactType']} for t in templates[:20]])}\n"
        f"KB hits: {hits[:5]}\n"
        f"Chat history:\n" + "\n".join(history_lines) + "\n"
        f"Latest user message: {clean_msg}"
    )

    completion = LlmClient(openai_api_key=settings.openai_api_key or None).complete(
        system=system,
        user=user_payload,
        max_tokens=4096,
        model=runtime["model_name"],
        fallback_model=runtime["fallback_model_name"],
    )

    raw = completion.text
    if "fallback" in completion.model and not allow_generation:
        fallback_missing = _missing_brief_fields(brief)
        envelope = AgentEnvelope(
            agent="content_generation",
            operation="studio_ask",
            result={
                "project_id": project_id,
                "turn_type": "ask",
                "ask": _questions_for_missing(
                    fallback_missing,
                    artifact_type=str(project.get("artifactType") or "deck"),
                )
                or ["Requirements captured. Click Generate to create the first draft."],
            },
            citations=[],
            confidence=0.5,
            cost={
                "tokens": completion.tokens_in + completion.tokens_out,
                "usd": completion.cost_usd,
                "model": completion.model,
            },
            trace_id=completion.trace_id,
            creative=True,
        )
        validate_envelope(envelope)
        return envelope

    operation = "studio_turn"
    turn_type = "unknown"
    result: Dict[str, Any] = {"project_id": project_id, "turn_type": turn_type}

    ask_block = _extract_block(raw, "ask")
    refuse_block = _extract_block(raw, "refuse")
    recommendations = _parse_template_recommendations(raw)
    tpl_attr, html_body = _extract_html_block(raw)
    patch = _parse_patch(raw)
    json_turn = _parse_json_turn(raw)
    force_fallback_generate = False

    if json_turn:
        turn = str(json_turn.get("turn_type", "")).strip().lower()
        if turn == "ask":
            ask_items = json_turn.get("ask") or []
            if isinstance(ask_items, list):
                ask_items = [str(x).strip() for x in ask_items if str(x).strip()]
            else:
                ask_items = []
            operation = "studio_ask"
            turn_type = "ask"
            result = {
                "project_id": project_id,
                "turn_type": turn_type,
                "ask": ask_items[:3] or ["Who is the audience for this deck?"],
            }
        elif turn == "recommend":
            recs = json_turn.get("recommended_templates") or []
            if isinstance(recs, list):
                recommendations = [
                    {"template_id": str(r.get("template_id", "")), "rationale": str(r.get("rationale", ""))}
                    for r in recs
                    if isinstance(r, dict) and r.get("template_id")
                ]
        elif turn == "html" and isinstance(json_turn.get("html"), str):
            html_body = str(json_turn.get("html"))

    if allow_generation and not html_body and patch is None and (ask_block or recommendations or (json_turn and str(json_turn.get("turn_type", "")).lower() in {"ask", "recommend"})):
        # In explicit generate mode, do not stay in ask/recommend loop.
        ask_block = None
        recommendations = []
        force_fallback_generate = True

    if refuse_block:
        operation = "studio_refuse"
        turn_type = "refuse"
        result = {"project_id": project_id, "turn_type": turn_type, "message": refuse_block}
    elif ask_block:
        operation = "studio_ask"
        turn_type = "ask"
        questions = [q.strip() for q in ask_block.split("\n") if q.strip()][:3]
        result = {"project_id": project_id, "turn_type": turn_type, "ask": questions}
    elif recommendations:
        operation = "template_recommend"
        turn_type = "recommend"
        result = {
            "project_id": project_id,
            "turn_type": turn_type,
            "recommended_templates": recommendations,
        }
        repo.update_project(
            ctx,
            project_id,
            {"recommendedTemplateIds": [r["template_id"] for r in recommendations]},
        )
    elif patch:
        operation = "html_patch"
        turn_type = "patch"
        _, violations = sanitize_html(patch["html"])
        if violations:
            raise ValueError(f"HTML guardrail violations: {violations}")
        latest = repo.latest_revision(ctx, project_id)
        merged_html = _apply_patch(latest["html"] if latest else "", patch)
        allowed_ids: Set[str] = repo.list_kb_asset_ids(ctx)
        cite_errors = validate_citations_in_html(merged_html, allowed_ids)
        if cite_errors:
            raise ValueError(f"Citation errors: {cite_errors}")
        rev = repo.create_revision(
            ctx,
            project_id,
            html=merged_html,
            citations=[c.model_dump() for c in citations],
            template_id=tpl_id,
        )
        result = {
            "project_id": project_id,
            "turn_type": turn_type,
            "revision_id": rev["id"],
            "patch": patch,
            "html": merged_html,
        }
    elif html_body:
        operation = "html_generate"
        turn_type = "html"
        full_html = html_body if html_body.strip().lower().startswith("<!") else _wrap_html(html_body, chosen_template)
        _, violations = sanitize_html(full_html)
        if violations:
            raise ValueError(f"HTML guardrail violations: {violations}")
        allowed_ids = repo.list_kb_asset_ids(ctx)
        cite_errors = validate_citations_in_html(full_html, allowed_ids)
        if cite_errors:
            raise ValueError(f"Citation errors: {cite_errors}")
        deck_err = validate_deck_slide_count(full_html, project.get("artifactType", "deck"))
        if deck_err:
            raise ValueError(deck_err)
        effective_tpl = tpl_attr or tpl_id
        rev = repo.create_revision(
            ctx,
            project_id,
            html=full_html,
            citations=[c.model_dump() for c in citations],
            template_id=effective_tpl,
        )
        if effective_tpl:
            repo.update_project(ctx, project_id, {"templateId": effective_tpl, "status": "preview"})
        result = {
            "project_id": project_id,
            "turn_type": turn_type,
            "revision_id": rev["id"],
            "html": full_html,
            "template_id": effective_tpl,
        }
    else:
        if allow_generation or force_fallback_generate:
            # If model still asks instead of generating, force a first-draft HTML so UI always gets preview output.
            operation = "html_generate"
            turn_type = "html"
            creative_mode = True
            fallback_html = _build_fallback_html(
                title=str(project.get("title", "Generated Deck")),
                artifact_type=str(project.get("artifactType", "deck")),
                brief=brief,
            )
            rev = repo.create_revision(
                ctx,
                project_id,
                html=fallback_html,
                citations=[c.model_dump() for c in citations],
                template_id=tpl_id,
            )
            if tpl_id:
                repo.update_project(ctx, project_id, {"templateId": tpl_id, "status": "preview"})
            result = {
                "project_id": project_id,
                "turn_type": turn_type,
                "revision_id": rev["id"],
                "html": fallback_html,
                "template_id": tpl_id,
            }
        else:
            operation = "studio_ask"
            turn_type = "ask"
            next_questions = ["Requirements captured. Click Generate to create the first draft."]
            result = {
                "project_id": project_id,
                "turn_type": turn_type,
                "ask": next_questions,
            }

    new_cost = float(project.get("costUsd", 0)) + completion.cost_usd
    project_ceiling = float(runtime["project_ceiling_usd"])
    if new_cost > project_ceiling:
        raise ValueError(f"Project cost ceiling ${project_ceiling:.2f} exceeded")
    repo.update_project(ctx, project_id, {"costUsd": new_cost})

    envelope = AgentEnvelope(
        agent="content_generation",
        operation=operation,
        result=result,
        citations=citations if operation in ("html_generate", "html_patch") else [],
        confidence=0.85 if turn_type == "html" else 0.7,
        cost={
            "tokens": completion.tokens_in + completion.tokens_out,
            "usd": completion.cost_usd,
            "model": completion.model,
        },
        trace_id=completion.trace_id,
        creative=creative_mode or (operation in ("html_generate", "html_patch") and len(citations) == 0),
    )
    validate_envelope(envelope)
    return envelope


def _wrap_html(body: str, template: Optional[Dict[str, Any]]) -> str:
    template_style = _extract_template_style(template)
    return (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
        f"<style>{template_style}</style></head><body>{body}</body></html>"
    )


def _extract_template_style(template: Optional[Dict[str, Any]]) -> str:
    vars_css = ""
    if template and template.get("cssVariables"):
        vars_lines = [f"  {k}: {v};" for k, v in template["cssVariables"].items()]
        vars_css = ":root {\n" + "\n".join(vars_lines) + "\n}\n"
    tpl_html = (template or {}).get("html") or ""
    base_style = ""
    if tpl_html and "<style" in tpl_html:
        m = re.search(r"<style[^>]*>(.*?)</style>", tpl_html, re.DOTALL | re.IGNORECASE)
        if m:
            base_style = m.group(1)
    return f"{vars_css}{base_style}".strip()


def _template_context(template: Optional[Dict[str, Any]]) -> str:
    if not template:
        return "none"
    tpl_html = str(template.get("html") or "")
    body = re.sub(r"<style[^>]*>.*?</style>", "", tpl_html, flags=re.DOTALL | re.IGNORECASE)
    body_match = re.search(r"<body[^>]*>(.*?)</body>", body, flags=re.DOTALL | re.IGNORECASE)
    if body_match:
        body = body_match.group(1)
    context = {
        "id": template.get("id"),
        "name": template.get("name"),
        "artifact_type": template.get("artifactType"),
        "css_variables": template.get("cssVariables") or {},
        "slots": _extract_template_slots(tpl_html),
        "css_excerpt": _extract_template_style(template)[:5000],
        "html_excerpt": body.strip()[:4000],
    }
    return json.dumps(context)


def _extract_template_slots(html: str) -> List[str]:
    slots: List[str] = []
    for pattern in (r'data-slot=["\']([^"\']+)["\']', r'data-role=["\']([^"\']+)["\']'):
        for value in re.findall(pattern, html, flags=re.IGNORECASE):
            clean = str(value).strip()
            if clean and clean not in slots:
                slots.append(clean)
    for class_attr in re.findall(r'class=["\']([^"\']+)["\']', html, flags=re.IGNORECASE):
        for token in str(class_attr).split():
            if any(key in token.lower() for key in ("title", "heading", "body", "visual", "metric", "cta")):
                if token not in slots:
                    slots.append(token)
    return slots[:20]


def _template_has_two_sections(template: Optional[Dict[str, Any]]) -> bool:
    """Return True when the template exposes two distinct body/content slots per slide."""
    if not template:
        return False
    metadata = template.get("metadata") or {}
    conversion = metadata.get("conversion") or {}
    try:
        section_count = int(conversion.get("sectionCount") or 1)
    except (TypeError, ValueError):
        section_count = 1
    if section_count >= 2:
        return True
    slots = _extract_template_slots(str(template.get("html") or ""))
    body_like = [
        s for s in slots
        if any(kw in s.lower() for kw in ("body", "section", "content", "column", "left", "right"))
    ]
    return len(body_like) >= 2


def _apply_patch(html: str, patch: Dict[str, Any]) -> str:
    slide_n = patch["slide"]
    section_re = re.compile(
        rf'(<section[^>]*data-slide="{slide_n}"[^>]*>)(.*?)(</section>)',
        re.DOTALL | re.IGNORECASE,
    )
    replacement = patch["html"]
    if section_re.search(html):
        return section_re.sub(rf"\1{replacement}\3", html, count=1)
    return html + f"\n{replacement}"


def _build_fallback_html(title: str, artifact_type: str, brief: Dict[str, Any]) -> str:
    audience = str(brief.get("audience", "Executive stakeholders")).strip()
    style = str(brief.get("content_context") or brief.get("style", "executive summary")).strip().capitalize()
    points = brief.get("pain_points_coverage") or brief.get("key_points")
    if not isinstance(points, list) or not points:
        points = [
            "Current challenge and business impact",
            "Proposed approach and expected outcomes",
            "Roadmap, risks, and next steps",
        ]
    bullets = "".join(f"<li>{str(p)}</li>" for p in points[:5])

    if artifact_type == "one_pager":
        body = f"""
        <article style="max-width:960px;margin:0 auto;padding:48px;font-family:Urbanist, Arial, sans-serif;">
          <h1>{title}</h1>
          <p><strong>Audience:</strong> {audience}</p>
          <p><strong>Style:</strong> {style}</p>
          <h2>Key Points</h2>
          <ul>{bullets}</ul>
        </article>
        """
    elif artifact_type == "image":
        body = f"""
        <figure style="width:1280px;height:720px;margin:0 auto;padding:40px;display:flex;flex-direction:column;justify-content:center;background:#f7fafc;font-family:Urbanist, Arial, sans-serif;">
          <h1 style="font-size:56px;line-height:1.1;margin:0 0 16px;">{title}</h1>
          <figcaption style="font-size:28px;color:#4a5568;">{audience} · {style}</figcaption>
        </figure>
        """
    else:
        body = f"""
        <section class="slide" data-slide="1" style="width:1280px;height:720px;margin:0 auto;padding:48px;font-family:Urbanist, Arial, sans-serif;background:#ffffff;">
          <h1 style="font-size:48px;line-height:1.15;margin:0 0 12px;">{title}</h1>
          <p style="font-size:24px;color:#4a5568;margin:0 0 24px;">Audience: {audience}</p>
          <ul style="font-size:28px;line-height:1.35;">{bullets}</ul>
        </section>
        <section class="slide" data-slide="2" style="width:1280px;height:720px;margin:0 auto;padding:48px;font-family:Urbanist, Arial, sans-serif;background:#f8fafc;">
          <h2 style="font-size:42px;margin:0 0 20px;">Approach</h2>
          <p style="font-size:26px;">Style: {style}</p>
          <p style="font-size:22px;color:#4a5568;">Use this draft as a base; refine content from chat and template selection.</p>
        </section>
        <section class="slide" data-slide="3" style="width:1280px;height:720px;margin:0 auto;padding:48px;font-family:Urbanist, Arial, sans-serif;background:#ffffff;">
          <h2 style="font-size:42px;margin:0 0 20px;">Next Steps</h2>
          <ol style="font-size:26px;line-height:1.4;">
            <li>Validate key messages with stakeholders</li>
            <li>Add supporting data and case evidence</li>
            <li>Finalize design and export</li>
          </ol>
        </section>
        """

    return f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{{margin:0;background:#fff}} .slide{{aspect-ratio:16/9;}}</style></head><body>{body}</body></html>"


def _normalize_brief(brief: Any) -> Dict[str, Any]:
    if isinstance(brief, dict):
        return dict(brief)
    return {}


def _has_suggestion_context(brief: Dict[str, Any]) -> bool:
    return bool(
        str(brief.get("generation_reason") or "").strip()
        or str(brief.get("needed_for") or "").strip()
        or str(brief.get("asset_name") or "").strip()
    )


def _extract_industry_from_needed_for(needed_for: str) -> Optional[str]:
    text = needed_for.strip()
    if not text:
        return None
    patterns = (
        r"(?:anchor the conversation|social proof aligned)\s+(?:to|for)\s+(.+?)(?:\.|$)",
        r"(?:conversation|material|proof)\s+for\s+(.+?)(?:\.|$)",
        r"for\s+(.+?)(?:\.|$)",
    )
    generic = {"their industry", "this call", "the call", "this account", "the account"}
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        candidate = (match.group(1) if match else "").strip().rstrip(".")
        if candidate and candidate.lower() not in generic and len(candidate) >= 3:
            return candidate
    return None


def _enrich_brief_from_suggestion(brief: Dict[str, Any], title: str, artifact_type: str) -> Dict[str, Any]:
    if not _has_suggestion_context(brief):
        return brief

    b = dict(brief)
    needed_for = str(b.get("needed_for") or "").strip()
    reason = str(b.get("generation_reason") or "").strip()
    requirements = str(b.get("content_requirements") or b.get("what_to_create") or "").strip()
    asset_name = str(b.get("asset_name") or title).strip()
    account = str(b.get("account_name") or "").strip()
    industry = str(b.get("industry") or "").strip() or _extract_industry_from_needed_for(needed_for) or ""

    if not str(b.get("audience", "")).strip():
        if industry:
            b["audience"] = f"{industry} stakeholders and decision makers"
        elif account:
            b["audience"] = f"{account} stakeholders"
        elif needed_for:
            b["audience"] = "Executive stakeholders aligned to the upcoming discovery conversation"
        else:
            b["audience"] = "Executive stakeholders"

    points = b.get("pain_points_coverage") or b.get("key_points")
    if not isinstance(points, list) or len([p for p in points if str(p).strip()]) == 0:
        derived: List[str] = []
        if needed_for:
            derived.append(needed_for)
        if requirements and requirements.lower() not in needed_for.lower():
            derived.append(requirements)
        if reason and reason.lower() not in needed_for.lower():
            derived.append(reason)
        lowered = asset_name.lower()
        if "overview" in lowered or artifact_type == "deck":
            derived.append("Position services and capabilities for the buyer conversation")
        if "case study" in lowered or artifact_type == "case_study":
            derived.append("Show measurable customer outcomes and proof points")
        if not derived:
            derived = ["Current challenge and business impact", "Recommended approach and expected outcomes"]
        b["pain_points_coverage"] = derived[:5]
        b["key_points"] = b["pain_points_coverage"]

    if not str(b.get("content_context", "")).strip():
        lowered = asset_name.lower()
        if "case study" in lowered or artifact_type == "case_study":
            b["content_context"] = f"Customer case study{f' for {industry}' if industry else ''}".strip()
        elif "one-pager" in lowered or "one pager" in lowered or artifact_type == "one_pager":
            b["content_context"] = f"Service one-pager{f' for {industry}' if industry else ''}".strip()
        elif "overview" in lowered or artifact_type == "deck":
            b["content_context"] = f"Services overview presentation{f' for {industry}' if industry else ''}".strip()
        elif reason:
            b["content_context"] = reason
        else:
            b["content_context"] = "Executive summary grounded in discovery context"
        b["style"] = b["content_context"]

    if artifact_type == "deck" and not _slide_count(b):
        b["slide_count"] = 5

    if industry:
        b["industry"] = industry

    return b


def _pick_default_templates(
    ctx: TenantContext,
    repo: ContentStudioRepository,
    project: Dict[str, Any],
    brief: Dict[str, Any],
    title: str,
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, str]]]:
    templates = repo.list_templates(ctx, artifact_type=project.get("artifactType"))
    if not templates:
        return None, []

    haystack = " ".join(
        str(part)
        for part in (
            title,
            brief.get("needed_for"),
            brief.get("generation_reason"),
            brief.get("asset_name"),
            brief.get("industry"),
            brief.get("content_context"),
        )
        if part
    ).lower()
    tokens = [token for token in re.split(r"[\s,/]+", haystack) if len(token) > 3]

    scored: List[Tuple[int, Dict[str, Any]]] = []
    for template in templates:
        score = 1
        name = str(template.get("name") or "").lower()
        tags = " ".join(str(tag) for tag in (template.get("tags") or [])).lower()
        for token in tokens:
            if token in name or token in tags:
                score += 2
        if template.get("isDefault"):
            score += 3
        scored.append((score, template))

    scored.sort(key=lambda item: item[0], reverse=True)
    best = scored[0][1] if scored else None
    recommendations = [
        {
            "template_id": str(item[1]["id"]),
            "rationale": f"Matches the suggested {title} format and topic.",
        }
        for item in scored[:3]
    ]
    return best, recommendations


def _retrieve_studio_kb_hits(ctx: TenantContext, query: str) -> List[Dict[str, Any]]:
    settings = get_settings()
    kb_repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    from app.domain.memory_store import get_memory_store

    def vector_search(tid: str, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        return kb_repo.match_chunks(tenant_uuid, embedding, limit=limit, clerk_key=clerk_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    return retrieve_kb(
        tenant_uuid,
        query,
        limit=5,
        chunks=get_memory_store().kb_chunks.get(clerk_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )


def _kb_matches_payload(hits: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    matches: List[Dict[str, str]] = []
    for hit in hits[:5]:
        asset_id = str(hit.get("asset_id") or "").strip()
        title = str(hit.get("title") or hit.get("asset_title") or "Knowledge base document").strip()
        snippet = str(hit.get("chunk_text") or hit.get("snippet") or "").strip()[:180]
        if asset_id or title:
            matches.append({"asset_id": asset_id, "title": title, "snippet": snippet})
    return matches


def _bootstrap_message(
    *,
    brief: Dict[str, Any],
    artifact_type: str,
    template_name: str,
    kb_hits: List[Dict[str, Any]],
    suggestion_plan: Optional[Dict[str, Any]] = None,
) -> str:
    account = str(brief.get("account_name") or "").strip()
    needed_for = str(brief.get("needed_for") or "").strip()
    requirements = str(brief.get("content_requirements") or brief.get("what_to_create") or "").strip()
    source_path = str(brief.get("source_path") or "").strip()
    lines = ["I pulled context from your content suggestion and drafted a starting plan."]

    if suggestion_plan:
        lead_count = int(suggestion_plan.get("lead_count") or 0)
        leads = suggestion_plan.get("leads") or []
        if lead_count > 1:
            names = [str(l.get("account_name") or l.get("lead_name") or "") for l in leads if isinstance(l, dict)]
            preview = ", ".join(n for n in names[:4] if n)
            extra = f" (+{lead_count - 4} more)" if lead_count > 4 else ""
            lines.append(f"This asset is needed by {lead_count} leads: {preview}{extra}.")
        elif leads and isinstance(leads[0], dict):
            lead = leads[0]
            if lead.get("account_name"):
                lines.append(f"Primary account: {lead['account_name']}.")

        evidence = suggestion_plan.get("evidence") or {}
        projects = evidence.get("projects") or []
        if projects:
            titles = [str(p.get("title") or "Project") for p in projects[:3] if isinstance(p, dict)]
            lines.append(f"Matching project data: {', '.join(titles)}.")

        slide_plan = suggestion_plan.get("slide_plan") or []
        reuse_count = sum(1 for s in slide_plan if isinstance(s, dict) and str(s.get("mode")) == "reuse")
        if reuse_count:
            lines.append(f"{reuse_count} slide{'s' if reuse_count != 1 else ''} will reuse existing KB content.")

        summary = str(suggestion_plan.get("plan_summary") or "").strip()
        if summary:
            lines.append(summary)

    if account and needed_for:
        lines.append(f"Account: {account}. Needed for: {needed_for}.")
    elif needed_for:
        lines.append(f"Needed for: {needed_for}.")
    elif account:
        lines.append(f"Account: {account}.")
    if requirements and requirements.lower() not in needed_for.lower():
        lines.append(f"What to create: {requirements}.")
    if source_path:
        lines.append(f"This maps back to {source_path} when saved to the KB.")

    if artifact_type == "deck":
        lines.append("Review each slide below and tell me what to change on any slide.")
    else:
        lines.append("Review the outline below and tell me what to adjust.")

    if template_name:
        lines.append(f"I selected {template_name} as the default template — change it on the right if you prefer another.")

    if kb_hits:
        titles = [str(hit.get("title") or hit.get("asset_title") or "KB document") for hit in kb_hits[:3]]
        lines.append(f"Related KB content I can ground claims in: {', '.join(titles)}.")

    lines.append("Click Generate when you're satisfied and I'll build the first draft.")
    return " ".join(lines)


def _kb_lookup_message(kb_hits: List[Dict[str, Any]], brief: Dict[str, Any]) -> str:
    if kb_hits:
        titles = [str(hit.get("title") or hit.get("asset_title") or "KB document") for hit in kb_hits[:5]]
        intro = f"Yes — I found {len(kb_hits)} relevant KB item{'s' if len(kb_hits) != 1 else ''}: {', '.join(titles)}."
    else:
        intro = "I didn't find close matches in the knowledge base yet for this suggestion."

    if brief.get("slide_outline"):
        return f"{intro} The slide plan below still stands — tell me what to change, or click Generate when you're ready."
    return f"{intro} Tell me what to emphasize and I'll refine the plan, or click Generate to draft from what we have."


def _is_kb_content_question(text: str) -> bool:
    low = text.strip().lower()
    if not low:
        return False
    patterns = (
        "relevant content",
        "related content",
        "knowledge base",
        "kb content",
        "do we have",
        "any content",
        "existing content",
        "uploaded content",
        "in the kb",
        "from the kb",
    )
    return any(pattern in low for pattern in patterns)


def _missing_brief_fields(brief: Dict[str, Any]) -> List[str]:
    if _get_suggestion_plan(brief) and _get_slide_plan(brief):
        return []
    missing: List[str] = []
    if not str(brief.get("audience", "")).strip():
        missing.append("audience")
    points = brief.get("pain_points_coverage") or brief.get("key_points")
    if not isinstance(points, list) or len([p for p in points if str(p).strip()]) == 0:
        missing.append("pain_points_coverage")
    if not str(brief.get("content_context", "")).strip():
        missing.append("content_context")
    if missing:
        return missing
    if str(brief.get("artifact_type", "deck")) == "deck" and not _slide_count(brief):
        missing.append("slide_count")
    return missing


def _questions_for_missing(missing: List[str], *, artifact_type: str = "deck") -> List[str]:
    artifact_label = {
        "deck": "deck",
        "one_pager": "one-pager",
        "image": "image",
    }.get(artifact_type, "draft")
    out: List[str] = []
    if "audience" in missing:
        out.append(f"Who is this {artifact_label} for, and what role or team should it speak to?")
    if "pain_points_coverage" in missing:
        out.append("Which customer pain points or business problems need to be covered?")
    if "content_context" in missing:
        out.append("Is this a case study, or can you describe the context this content should use?")
    if "slide_count" in missing:
        out.append("How many slides should this deck include?")
    return out[:3]


def _brief_with_defaults(brief: Dict[str, Any]) -> Dict[str, Any]:
    b = dict(brief)
    b["audience"] = str(b.get("audience", "")).strip() or "Executive stakeholders"
    points = b.get("pain_points_coverage") or b.get("key_points")
    if not isinstance(points, list) or len([p for p in points if str(p).strip()]) == 0:
        b["pain_points_coverage"] = [
            "Current challenge and why it matters",
            "Recommended approach and expected outcomes",
            "Roadmap with risks and next steps",
        ]
    else:
        b["pain_points_coverage"] = [str(p).strip() for p in points if str(p).strip()]
    b["key_points"] = b.get("key_points") or b["pain_points_coverage"]
    b["content_context"] = str(b.get("content_context", "")).strip() or str(b.get("style", "")).strip() or "executive summary"
    b["style"] = b.get("style") or b["content_context"]
    if not _slide_count(b):
        b["slide_count"] = 5
    if _needs_slide_outline(b, str(b.get("artifact_type") or "deck")):
        b["slide_outline"] = _build_slide_outline(title="Generated Deck", brief=b)
    return b


def _looks_like_key_points(text: str) -> bool:
    lines = _split_points(text)
    if len(lines) >= 3:
        return True
    numbered = re.findall(r"(?:^|\n)\s*\d+[.)]\s+.+", text)
    return len(numbered) >= 3


def _extract_key_points(text: str) -> List[str]:
    lines = _split_points(text)
    dedup: List[str] = []
    for line in lines:
        if line and line not in dedup:
            dedup.append(line)
    return dedup[:5]


def _split_points(text: str) -> List[str]:
    raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(raw_lines) >= 3:
        return [re.sub(r"^[-*•\d\.\)\s]+", "", ln).strip() for ln in raw_lines if ln.strip()]
    if ";" in text or "|" in text:
        parts = [p.strip("-*• \t") for p in re.split(r";|\|", text) if p.strip("-*• \t")]
        return parts
    if "," in text:
        parts = [p.strip("-*• \t") for p in text.split(",") if p.strip("-*• \t")]
        if len(parts) >= 3:
            return parts
    numbered = re.split(r"(?:^|\s)\d+[.)]\s+", text.strip())
    numbered = [p.strip() for p in numbered if p and p.strip()]
    if len(numbered) >= 3:
        return numbered
    return []


def _update_brief_from_reply(brief: Dict[str, Any], text: str) -> Dict[str, Any]:
    b = dict(brief)
    raw = text.strip().replace("“", '"').replace("”", '"')
    low = raw.lower()

    if not raw:
        return b

    if _apply_slide_outline_edit(b, raw):
        return b

    if _apply_suggestion_plan_chat(b, raw):
        return b

    labeled = _extract_labeled_sections(raw)
    if labeled:
        audience = labeled.get("audience")
        if audience:
            b["audience"] = audience

        pain_text = (
            labeled.get("pain points")
            or labeled.get("pain point")
            or labeled.get("business problems")
            or labeled.get("problems")
            or labeled.get("coverage")
            or labeled.get("key points")
        )
        if pain_text:
            points = _extract_key_points(pain_text)
            b["pain_points_coverage"] = points or [pain_text]
            b["key_points"] = b["pain_points_coverage"]

        context = labeled.get("context")
        case_study = labeled.get("case study")
        tone = labeled.get("tone") or labeled.get("style")
        if case_study:
            b["content_context"] = f"Case study: {case_study}"
        elif context:
            b["content_context"] = context
        elif tone:
            b["content_context"] = tone
        if tone:
            b["style"] = tone

        slides = (
            labeled.get("slides")
            or labeled.get("slide count")
            or labeled.get("number of slides")
        )
        if slides:
            count = _parse_slide_count(slides)
            if count:
                b["slide_count"] = count

        if any(key in labeled for key in ("audience", "pain points", "pain point", "business problems", "problems", "coverage", "key points", "context", "case study", "tone", "style", "slides", "slide count", "number of slides")):
            return b

    # Users often paste the prompt + answer together; keep only the answer.
    if low.startswith("who is the audience?") or low.startswith("who is this"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()
    elif low.startswith("which customer pain points") or low.startswith("what needs to be covered"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()
    elif low.startswith("is this a case study") or low.startswith("can you describe the context"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()
    elif low.startswith("how many slides"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()

    slide_count = _parse_slide_count(raw)
    if "slide_count" in _missing_brief_fields(b) and slide_count:
        b["slide_count"] = slide_count
        return b

    if low.startswith("audience:"):
        b["audience"] = raw.split(":", 1)[1].strip()
        return b
    if low.startswith("context:") or low.startswith("case study:"):
        b["content_context"] = raw.split(":", 1)[1].strip()
        return b
    if low.startswith("style:") or low.startswith("tone:"):
        b["content_context"] = raw.split(":", 1)[1].strip()
        b["style"] = b["content_context"]
        return b
    if low.startswith("pain points:") or low.startswith("pain point:") or low.startswith("coverage:") or low.startswith("key points:") or low.startswith("keypoints:"):
        b["pain_points_coverage"] = _extract_key_points(raw.split(":", 1)[1]) or [raw.split(":", 1)[1].strip()]
        b["key_points"] = b["pain_points_coverage"]
        return b

    missing = _missing_brief_fields(b)
    if "audience" in missing and (
        "audience" in low
        or "stakeholder" in low
        or low.startswith("for ")
        or low.startswith("target ")
    ):
        if len(raw.split()) >= 5:
            b["audience"] = raw
            return b
    if "audience" in missing and not _looks_like_key_points(raw):
        b["audience"] = raw
        return b
    if "pain_points_coverage" in missing and _looks_like_key_points(raw):
        b["pain_points_coverage"] = _extract_key_points(raw)
        b["key_points"] = b["pain_points_coverage"]
        return b
    if "pain_points_coverage" in missing and any(k in low for k in ["pain", "problem", "challenge", "friction", "manual", "slow", "visibility", "cost", "risk"]):
        points = _extract_key_points(raw)
        b["pain_points_coverage"] = points or [raw]
        b["key_points"] = b["pain_points_coverage"]
        return b
    if "pain_points_coverage" in missing and raw and not _looks_like_context_answer(raw):
        points = _extract_key_points(raw)
        b["pain_points_coverage"] = points or [raw]
        b["key_points"] = b["pain_points_coverage"]
        return b
    if "content_context" in missing:
        b["content_context"] = raw
        b["style"] = raw
        return b
    return b


def _looks_like_context_answer(text: str) -> bool:
    low = text.strip().lower()
    if not low:
        return False
    return any(
        phrase in low
        for phrase in (
            "case study",
            "customer story",
            "executive summary",
            "proposal",
            "pitch",
            "portfolio",
            "overview",
            "internal",
            "customer-facing",
            "sales enablement",
            "board",
            "investor",
        )
    )


def _extract_labeled_sections(text: str) -> Dict[str, str]:
    labels = (
        "audience",
        "pain points",
        "pain point",
        "business problems",
        "problems",
        "coverage",
        "context",
        "case study",
        "slides",
        "slide count",
        "number of slides",
        "key points",
        "keypoints",
        "style",
        "tone",
        "heading",
        "title",
        "body",
        "body text",
        "text",
        "visual",
        "image",
        "chart",
    )
    label_re = "|".join(re.escape(label) for label in sorted(labels, key=len, reverse=True))
    matches = list(re.finditer(rf"(?i)\b({label_re})\s*:", text))
    out: Dict[str, str] = {}
    for i, match in enumerate(matches):
        key = match.group(1).lower()
        if key == "keypoints":
            key = "key points"
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        value = text[start:end].strip(" .\n\t")
        if value:
            out[key] = value
    return out


def _parse_slide_count(text: str) -> Optional[int]:
    m = re.search(r"\b(\d{1,2})\b", text)
    if not m:
        return None
    value = int(m.group(1))
    return max(1, min(value, 20))


def _slide_count(brief: Dict[str, Any]) -> Optional[int]:
    value = brief.get("slide_count")
    if isinstance(value, int):
        return max(1, min(value, 20))
    if isinstance(value, str):
        return _parse_slide_count(value)
    return None


def _needs_slide_outline(brief: Dict[str, Any], artifact_type: str) -> bool:
    if artifact_type != "deck":
        return False
    outline = brief.get("slide_outline")
    return not isinstance(outline, list) or len(outline) == 0


def _build_slide_outline(
    title: str,
    brief: Dict[str, Any],
    *,
    two_sections: bool = False,
) -> List[Dict[str, Any]]:
    count = _slide_count(brief) or 5
    audience = str(brief.get("audience") or "Executive stakeholders")
    context = str(brief.get("content_context") or "Discovery context")
    points = brief.get("pain_points_coverage") or brief.get("key_points") or []
    if not isinstance(points, list):
        points = [str(points)]
    clean_points = [str(point).strip() for point in points if str(point).strip()]
    if not clean_points:
        clean_points = ["Current pain point", "Recommended approach", "Expected outcome"]

    outline: List[Dict[str, Any]] = []

    # Slide 1: Title / opener
    title_slide: Dict[str, Any] = {
        "slide": 1,
        "heading": title,
        "body": f"Set the context for {audience} and frame why this conversation matters now.",
        "visual": "Account logo or relevant hero image",
    }
    if two_sections:
        title_slide["section_a"] = f"Set the context for {audience} and explain the current situation."
        title_slide["section_b"] = "Frame why this conversation is urgent and what the audience will gain."
    outline.append(title_slide)

    middle_slots = max(0, count - 2)
    for index in range(middle_slots):
        point = clean_points[index % len(clean_points)]
        slide: Dict[str, Any] = {
            "slide": index + 2,
            "heading": point[:72],
            "body": f"Explain the pain point, business impact, and what the audience needs to believe. Context: {context}.",
            "visual": "Pain-impact chart or workflow diagram",
        }
        if two_sections:
            slide["section_a"] = (
                f"Pain point: {point[:100]}. Describe the business impact and why it matters now."
            )
            slide["section_b"] = (
                f"Recommended approach: Address this with a targeted solution. Context: {context}."
            )
        outline.append(slide)

    if count > 1:
        closing: Dict[str, Any] = {
            "slide": count,
            "heading": "Recommended next steps",
            "body": "Summarize the proposed path, ownership, and the next decision the buyer should make.",
            "visual": "Timeline or next-step checklist",
        }
        if two_sections:
            closing["section_a"] = "Immediate actions: Define ownership and set a timeline for the first milestone."
            closing["section_b"] = "Decision point: Identify the key question the buyer must answer to move forward."
        outline.append(closing)

    return outline[:count]


def _is_slide_outline_edit(text: str, brief: Dict[str, Any]) -> bool:
    outline = brief.get("slide_outline")
    return isinstance(outline, list) and bool(re.search(r"(?i)\bslide\s*\d{1,2}\b", text))


def _slide_number_from_text(text: str) -> Optional[int]:
    m = re.search(r"(?i)\bslide\s*(\d{1,2})\b", text)
    if not m:
        return None
    return int(m.group(1))


def _build_slide_preview_html(
    title: str,
    brief: Dict[str, Any],
    template: Optional[Dict[str, Any]] = None,
) -> str:
    outline = brief.get("slide_outline")
    if not isinstance(outline, list) or not outline:
        outline = _build_slide_outline(title=title, brief=brief)

    slides: List[str] = []
    for index, item in enumerate(outline[:20], start=1):
        if not isinstance(item, dict):
            continue
        slide_num = int(item.get("slide") or index)
        heading = html_lib.escape(str(item.get("heading") or f"Slide {slide_num}").strip())
        body = html_lib.escape(str(item.get("body") or "").strip())
        section_a = html_lib.escape(str(item.get("section_a") or "").strip())
        section_b = html_lib.escape(str(item.get("section_b") or "").strip())
        visual = html_lib.escape(str(item.get("visual") or "").strip())
        evidence = html_lib.escape(str(item.get("evidence") or "").strip())
        citation_source = html_lib.escape(str(item.get("citation_source") or "").strip())
        cite = f'<span class="cite" data-source="{citation_source}"></span>' if citation_source else ""
        title_tag = "h1" if slide_num == 1 else "h2"
        visual_block = (
            f'<div class="visual"><strong>Visual:</strong><span>{visual}</span></div>'
            if visual
            else ""
        )
        evidence_block = f'<p class="evidence-note">Evidence: {evidence} {cite}</p>' if evidence else ""

        if section_a or section_b:
            content_block = f"""
              <div class="two-col" data-role="two-section">
                <div class="col col-a" data-role="section-a">
                  <p class="col-label">Section A</p>
                  <p data-role="body">{section_a or body} {cite}</p>
                </div>
                <div class="col col-b" data-role="section-b">
                  <p class="col-label">Section B</p>
                  <p data-role="body-b">{section_b} {cite}</p>
                </div>
              </div>
            """
        else:
            content_block = f'<p data-role="body">{body} {cite}</p>'

        slides.append(
            f"""
            <section class="slide dc-slide template-root" data-slide="{slide_num}" data-role="studio-slide">
              <div class="slide-kicker">Slide {slide_num:02d}</div>
              <{title_tag} data-role="heading">{heading} {cite}</{title_tag}>
              {content_block}
              {visual_block}
              {evidence_block}
            </section>
            """
        )

    if not slides:
        return _build_fallback_html(title, "deck", brief)

    template_style = _extract_template_style(template)

    return f"""
    <html>
      <head>
        <style>
          {template_style}
          html, body {{
            margin: 0;
            min-height: 100%;
            background: var(--bg, #e8eef7);
            color: var(--text, #0f172a);
            font-family: Urbanist, Arial, sans-serif;
          }}
          body {{
            box-sizing: border-box;
          }}
          .deck-preview {{
            display: grid;
            gap: 28px;
            padding: 28px;
          }}
          .dc-slide {{
            width: min(100%, 1080px);
            aspect-ratio: 16 / 9;
            box-sizing: border-box;
            margin: 0 auto;
            padding: 56px;
            border: 1px solid var(--border, #d7dfeb);
            border-radius: 8px;
            background: var(--surface, #ffffff);
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
            overflow: hidden;
          }}
          .dc-slide:nth-child(even) {{
            background: color-mix(in srgb, var(--surface, #ffffff) 94%, var(--accent, #2563eb));
          }}
          .slide-kicker {{
            margin-bottom: 18px;
            color: var(--accent, #2563eb);
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0;
            text-transform: uppercase;
          }}
          h1, h2 {{
            margin: 0;
            max-width: 900px;
            color: var(--text, #111827);
            font-weight: 800;
            letter-spacing: 0;
          }}
          h1 {{
            font-size: 52px;
            line-height: 1.04;
          }}
          h2 {{
            font-size: 42px;
            line-height: 1.08;
          }}
          p {{
            margin: 24px 0 0;
            max-width: 820px;
            color: var(--muted, #334155);
            font-size: 25px;
            line-height: 1.38;
          }}
          .visual {{
            display: flex;
            gap: 10px;
            align-items: center;
            margin-top: 34px;
            max-width: 760px;
            border-left: 5px solid var(--accent, #2563eb);
            border-radius: 8px;
            background: color-mix(in srgb, var(--surface, #ffffff) 85%, var(--accent, #2563eb));
            padding: 16px 18px;
            color: var(--text, #1e3a8a);
            font-size: 19px;
            line-height: 1.35;
          }}
          .visual strong {{
            color: var(--accent, #1d4ed8);
            white-space: nowrap;
          }}
          .evidence-note {{
            margin-top: 22px;
            max-width: 760px;
            font-size: 15px;
            line-height: 1.4;
            color: var(--muted, #64748b);
          }}
          .two-col {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-top: 20px;
          }}
          .col {{
            display: flex;
            flex-direction: column;
            gap: 8px;
          }}
          .col-b {{
            border-left: 2px solid var(--border, #e2e8f0);
            padding-left: 32px;
          }}
          .col-label {{
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--accent, #2563eb);
            opacity: 0.7;
          }}
          .cite {{
            display: inline-block;
            width: 0;
            height: 0;
            overflow: hidden;
          }}
          @media (max-width: 760px) {{
            .deck-preview {{
              padding: 14px;
              gap: 16px;
            }}
            .dc-slide {{
              padding: 28px;
              border-radius: 12px;
            }}
            h1 {{
              font-size: 32px;
            }}
            h2 {{
              font-size: 28px;
            }}
            p {{
              font-size: 17px;
            }}
            .visual {{
              align-items: flex-start;
              flex-direction: column;
              font-size: 14px;
            }}
          }}
        </style>
      </head>
      <body>
        <main class="deck-preview">
          {''.join(slides)}
        </main>
      </body>
    </html>
    """


def _apply_suggestion_plan_chat(brief: Dict[str, Any], text: str) -> bool:
    plan = _get_suggestion_plan(brief)
    if not plan:
        return False
    slide_plan = plan.get("slide_plan")
    if not isinstance(slide_plan, list) or not slide_plan:
        return False

    low = text.strip().lower()
    changed = False

    remove_match = re.search(r"(?:remove|delete|drop)\s+slide\s*(\d{1,2})", low)
    if remove_match:
        target = int(remove_match.group(1))
        slide_plan = [item for item in slide_plan if isinstance(item, dict) and int(item.get("slide") or 0) != target]
        for index, item in enumerate(slide_plan, start=1):
            if isinstance(item, dict):
                item["slide"] = index
        changed = True

    reuse_match = re.search(
        r"use\s+slide\s*(\d{1,2})\s+from\s+(.+?)\s+for\s+slide\s*(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if reuse_match:
        source_idx = int(reuse_match.group(1))
        source_label = reuse_match.group(2).strip()
        target_idx = int(reuse_match.group(3))
        asset_id = ""
        for kb in (plan.get("evidence") or {}).get("kb_assets") or []:
            if isinstance(kb, dict) and source_label.lower() in str(kb.get("title") or "").lower():
                asset_id = str(kb.get("asset_id") or "")
                break
        for item in slide_plan:
            if isinstance(item, dict) and int(item.get("slide") or 0) == target_idx:
                item["mode"] = "reuse"
                item["reuse"] = {
                    "source_asset_id": asset_id or source_label,
                    "source_slide_index": source_idx,
                    "source_vertical": source_label,
                    "rationale": f"User requested reuse of slide {source_idx} from {source_label}",
                }
                changed = True
                break

    if changed:
        synced = _sync_slide_plan_to_brief(brief, slide_plan)
        brief.clear()
        brief.update(synced)
    return changed


def _apply_slide_outline_edit(brief: Dict[str, Any], text: str) -> bool:
    outline = brief.get("slide_outline")
    if not isinstance(outline, list) or not outline:
        return False
    m = re.search(r"(?i)\bslide\s*(\d{1,2})\b", text)
    if not m:
        return False
    slide_num = int(m.group(1))
    target = next((item for item in outline if isinstance(item, dict) and int(item.get("slide") or 0) == slide_num), None)
    if not target:
        return False

    sections = _extract_labeled_sections(text)
    changed = False
    heading = sections.get("heading") or sections.get("title")
    if heading:
        target["heading"] = heading
        changed = True
    body = sections.get("body") or sections.get("body text") or sections.get("text")
    if body:
        target["body"] = body
        changed = True
    visual = sections.get("visual") or sections.get("image") or sections.get("chart")
    if visual:
        target["visual"] = visual
        changed = True

    if not changed:
        remainder = re.sub(r"(?i).*?\bslide\s*\d{1,2}\b\s*[:,-]?", "", text, count=1).strip()
        if remainder and _apply_tone_instruction(target, remainder):
            changed = True
        elif remainder:
            target["body"] = remainder
            changed = True

    if changed:
        brief["slide_outline"] = outline
        plan = _get_suggestion_plan(brief)
        if plan and isinstance(plan.get("slide_plan"), list):
            for item in plan["slide_plan"]:
                if isinstance(item, dict) and int(item.get("slide") or 0) == slide_num:
                    if heading:
                        item["heading"] = heading
                    if body:
                        item["body"] = body
                    if visual:
                        item["visual"] = visual
                    break
            brief["suggestion_plan"] = plan
    return changed


def _apply_tone_instruction(target: Dict[str, Any], instruction: str) -> bool:
    low = instruction.lower()
    body = str(target.get("body") or target.get("heading") or "").strip()
    heading = str(target.get("heading") or "").strip()
    if not body and not heading:
        return False

    if any(word in low for word in ("punchier", "sharper", "stronger", "more direct")):
        target["body"] = _tighten_sentence(body, prefix="Lead with the business impact: ")
        return True
    if any(word in low for word in ("shorter", "concise", "tighten", "trim")):
        target["body"] = _tighten_sentence(body)
        return True
    if any(word in low for word in ("executive", "board", "c-level", "c level")):
        target["body"] = _tighten_sentence(body, prefix="Frame the decision, risk, and upside for executives: ")
        return True
    if any(word in low for word in ("customer", "buyer", "client-facing", "client facing")):
        target["body"] = _tighten_sentence(body, prefix="Use customer-facing language: ")
        return True
    return False


def _tighten_sentence(text: str, *, prefix: str = "") -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    if len(clean) > 180:
        clean = clean[:177].rstrip(" ,.;:") + "..."
    return f"{prefix}{clean}" if prefix and not clean.lower().startswith(prefix.lower()) else clean


# ──────────────────────────────────────────────────────────────────────────────
# Real-time streaming chat agent
# ──────────────────────────────────────────────────────────────────────────────

def _build_chat_system_prompt(
    *,
    project: Dict[str, Any],
    brief: Dict[str, Any],
    template: Optional[Dict[str, Any]],
    kb_hits: List[Dict[str, Any]],
) -> str:
    artifact_type = str(project.get("artifactType") or "deck")
    artifact_label = {
        "deck": "presentation deck",
        "one_pager": "one-pager",
        "image": "visual/image asset",
    }.get(artifact_type, "content")
    title = str(project.get("title") or "Untitled")

    # ── Template context ─────────────────────────────────────────────────────
    if template:
        tpl_name = str(template.get("name") or "Custom template")
        meta = template.get("metadata") or {}
        slides_meta = (meta.get("slides") or []) if isinstance(meta, dict) else []
        slide_count = int(template.get("pageCount") or template.get("page_count") or 0) or len(slides_meta)
        if slides_meta:
            slide_lines = ", ".join(
                f"Slide {s.get('slide')}: {s.get('name') or s.get('title') or 'Untitled'}"
                for s in slides_meta[:14]
                if isinstance(s, dict)
            )
            tpl_context = f"{tpl_name} — {slide_count} slides ({slide_lines})"
        elif slide_count:
            tpl_context = f"{tpl_name} — {slide_count} slides"
        else:
            slots = _extract_template_slots(str(template.get("html") or ""))
            tpl_context = tpl_name + (f" (slot types: {', '.join(slots[:8])})" if slots else "")
    else:
        tpl_context = "None selected (user can pick one from the right panel)"
        slide_count = 0

    # ── Suggestion context (rich brief from content gap / pre-DC / post-DC) ──
    has_suggestion = _has_suggestion_context(brief)
    suggestion_plan = _get_suggestion_plan(brief)

    suggestion_section = ""
    if has_suggestion:
        sug_parts: List[str] = []

        asset_name = str(brief.get("asset_name") or title).strip()
        generation_reason = str(brief.get("generation_reason") or "").strip()
        needed_for = str(brief.get("needed_for") or "").strip()
        account_name = str(brief.get("account_name") or "").strip()
        lead_name = str(brief.get("lead_name") or "").strip()
        industry = str(brief.get("industry") or "").strip()
        content_reqs = str(
            brief.get("content_requirements") or brief.get("what_to_create") or ""
        ).strip()
        source = str(brief.get("source") or "").strip()
        lead_count = int(brief.get("lead_count") or 0)
        leads_raw = brief.get("leads") or []

        sug_parts.append(f"- Asset requested: {asset_name}")
        if source:
            label = {"pre-dc": "Pre-call (Pre-DC)", "post-dc": "Post-call (Post-DC)"}.get(source, source)
            sug_parts.append(f"- Source workflow: {label}")
        if generation_reason:
            sug_parts.append(f"- Why it's needed: {generation_reason}")
        if needed_for:
            sug_parts.append(f"- Needed for: {needed_for}")
        if account_name:
            sug_parts.append(f"- Account/company: {account_name}")
        if lead_name:
            sug_parts.append(f"- Primary contact: {lead_name}")
        if industry:
            sug_parts.append(f"- Industry: {industry}")
        if content_reqs:
            sug_parts.append(f"- What to create: {content_reqs}")
        if lead_count > 1:
            sug_parts.append(f"- Reusable across: {lead_count} leads")
            if isinstance(leads_raw, list):
                names = [
                    str(l.get("account_name") or l.get("leadName") or "")
                    for l in leads_raw[:5]
                    if isinstance(l, dict)
                ]
                names = [n for n in names if n]
                if names:
                    sug_parts.append(f"  Accounts: {', '.join(names)}")

        # Evidence from suggestion plan
        if suggestion_plan:
            evidence = suggestion_plan.get("evidence") or {}
            projects_ev = evidence.get("projects") or []
            kb_ev = evidence.get("kb_assets") or []
            if projects_ev:
                pnames = [str(p.get("title") or "Project") for p in projects_ev[:4] if isinstance(p, dict)]
                sug_parts.append(f"- Evidence projects: {', '.join(pnames)}")
            if kb_ev:
                knames = [str(k.get("title") or "KB asset") for k in kb_ev[:4] if isinstance(k, dict)]
                sug_parts.append(f"- KB evidence: {', '.join(knames)}")

            plan_summary = str(suggestion_plan.get("plan_summary") or "").strip()
            if plan_summary:
                sug_parts.append(f"- Plan summary: {plan_summary}")

        suggestion_section = "\n".join(sug_parts)

    # ── Planned slide outline (from suggestion_plan.slide_plan) ──────────────
    planned_outline_section = ""
    if suggestion_plan:
        slide_plan = suggestion_plan.get("slide_plan") or []
        if slide_plan and isinstance(slide_plan, list):
            outline_lines: List[str] = []
            for sp in slide_plan:
                if not isinstance(sp, dict):
                    continue
                n = sp.get("slide", "?")
                heading = str(sp.get("heading") or sp.get("title") or "Slide").strip()
                body = str(sp.get("body") or sp.get("intent") or "").strip()
                mode = str(sp.get("mode") or "generate").strip()
                mode_tag = " [reuse KB]" if mode == "reuse" else ""
                body_snippet = f": {body[:90]}" if body else ""
                outline_lines.append(f"  Slide {n} – {heading}{body_snippet}{mode_tag}")
            if outline_lines:
                planned_outline_section = "\n".join(outline_lines)

    # ── Generic brief fields (audience, style, key messages) ─────────────────
    audience = str(brief.get("audience") or "").strip()
    context_style = str(brief.get("content_context") or brief.get("style") or "").strip()
    points = brief.get("pain_points_coverage") or brief.get("key_points") or []
    points_lines = [str(p).strip() for p in (points if isinstance(points, list) else []) if str(p).strip()]
    slide_count_brief = int(brief.get("slide_count") or 0)

    generic_parts: List[str] = []
    if audience:
        generic_parts.append(f"- Audience: {audience}")
    if context_style:
        generic_parts.append(f"- Style/context: {context_style}")
    if points_lines:
        generic_parts.append(f"- Key messages: {'; '.join(points_lines[:5])}")
    if slide_count_brief and not planned_outline_section:
        generic_parts.append(f"- Desired slide count: {slide_count_brief}")
    brief_section = "\n".join(generic_parts) if generic_parts else (
        "Nothing gathered yet." if not has_suggestion else ""
    )

    # ── KB assets ─────────────────────────────────────────────────────────────
    if kb_hits:
        kb_lines = [
            f"- {str(h.get('title') or h.get('asset_title') or 'KB doc')}"
            + (f": {str(h.get('chunk_text') or '')[:80]}..." if h.get("chunk_text") else "")
            for h in kb_hits[:5]
        ]
        kb_section = "\n".join(kb_lines)
    else:
        kb_section = "No KB assets found. User can upload content to the knowledge base."

    # ── Slide count / generation instructions ─────────────────────────────────
    effective_slide_count = slide_count or slide_count_brief or (
        len(suggestion_plan.get("slide_plan") or []) if suggestion_plan else 0
    )
    if effective_slide_count:
        slide_instruction = (
            f"The outline MUST have exactly {effective_slide_count} slides"
            + (f" (from the selected template '{template.get('name')}')" if template else " (from the suggestion plan)")
            + "."
        )
    else:
        slide_instruction = "Propose a slide count that fits the content scope (typically 8-12 for a deck)."

    # ── Behavioral mode ───────────────────────────────────────────────────────
    if has_suggestion:
        # Rich context already available — skip the Q&A phase
        behavioral_rules = """## Behavioral Rules (Suggestion Context Mode)
You already have rich context from a content gap analysis. DO NOT ask for context that's already available above.

1. **First message / greeting** — Briefly acknowledge the suggestion context (asset, account, why it's needed) in 1-2 sentences, then immediately present a proposed slide outline based on the planned slides above. End with "Ready to generate — shall I go ahead?"
2. **User approves / says yes / "go ahead"** — Write 1 line confirming then place `<generate_now/>` on its own line.
3. **User wants changes** — Make the requested change to the outline, confirm briefly, and ask "Shall I generate now?" again.
4. **Slide-level edit after generation** — End the reply with `<update_slide n="N">exact instructions</update_slide>`.
5. **Keep it short** — 2-4 sentences plus the outline. Do NOT re-explain the suggestion context the user already sees above the chat.
6. **Be specific** — Reference the account name, asset name, and the reason it's needed when relevant. Make it feel tailored, not generic."""
    else:
        # No suggestion context — normal conversational Q&A flow
        behavioral_rules = """## Behavioral Rules
1. **Greeting** — If the user greets you (hi/hello/hey), respond warmly in 1-2 lines and ask what they want to create.
2. **Context gathering** — Ask ONE focused question at a time. Stop after you have: audience, key messages, and use case. Never ask more than 2 questions at once.
3. **Outline proposal** — When you have enough context, propose a numbered slide-by-slide outline. Format: `Slide N – [Title]: [1-line description]`. Match template slide count exactly if one is selected.
4. **Generation trigger** — After proposing an outline, if the user says "generate", "go ahead", "looks good", "yes", "do it", or explicitly approves, write your final reply then end with `<generate_now/>` on its own line.
5. **Slide edit** — When the user asks to change a specific slide, write what you'll change then end with `<update_slide n="N">exact change instructions</update_slide>` on its own line.
6. **Keep it concise** — 2-4 sentences per reply unless you're showing a full outline.
7. **Be intelligent** — Reference the KB, reason about what the user needs, adapt your tone."""

    # ── Assemble prompt ───────────────────────────────────────────────────────
    prompt_parts = [
        f'You are the Content Studio AI for a B2B sales enablement platform. You help users create {artifact_label}s through natural, intelligent conversation — not a scripted Q&A bot.',
        "",
        "## Current Project",
        f'- Title: "{title}"',
        f"- Type: {artifact_label}",
        f"- Template: {tpl_context}",
    ]

    if suggestion_section:
        prompt_parts += ["", "## Content Gap Context (pre-loaded from suggestion)", suggestion_section]

    if planned_outline_section:
        prompt_parts += ["", "## Planned Slide Structure (from suggestion analysis)", planned_outline_section]

    if brief_section:
        prompt_parts += ["", "## Additional Context", brief_section]

    prompt_parts += ["", "## Knowledge Base Content Available", kb_section]
    prompt_parts += ["", f"## Slide Count Requirement\n{slide_instruction}"]
    prompt_parts += ["", behavioral_rules]
    prompt_parts += [
        "",
        "## Output Signals (place at the very end of your message, nothing after them)",
        "- `<generate_now/>` — triggers full HTML content generation",
        "- `<update_slide n=\"N\">plain English instructions</update_slide>` — triggers a targeted slide patch",
        "",
        "## Critical",
        "- NEVER include signal tags unless the user is ready to generate or explicitly asked for a slide edit.",
        "- When the user asks about KB content, answer based on the Knowledge Base section above.",
        "- If asked about KB content and none matches, say so honestly.",
    ]

    return "\n".join(prompt_parts)


def _messages_to_openai_history(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert stored project messages to OpenAI multi-turn chat format."""
    out: List[Dict[str, Any]] = []
    for msg in messages:
        role = str(msg.get("role") or "user")
        if role not in ("user", "assistant"):
            continue
        content = msg.get("content") or {}
        if isinstance(content, dict):
            text = str(
                content.get("text")
                or content.get("message")
                or (
                    " ".join(str(q) for q in content["ask"] if q)
                    if isinstance(content.get("ask"), list)
                    else str(content.get("ask") or "")
                )
            ).strip()
        else:
            text = str(content).strip()
        # Strip internal signal tags from history so model doesn't repeat them
        text = re.sub(r"<generate_now\s*/>", "", text).strip()
        text = re.sub(r"<update_slide[^>]*>.*?</update_slide>", "", text, flags=re.DOTALL).strip()
        if text:
            out.append({"role": role, "content": text})
    return out[-24:]  # Last 12 turns to keep context window manageable


def stream_studio_chat(
    ctx: TenantContext,
    *,
    project_id: str,
    user_message: str,
    template_id: Optional[str] = None,
    generate: bool = False,
    repo: Optional[ContentStudioRepository] = None,
) -> Generator[str, None, None]:
    """Stream a real-time GPT chat turn for the Content Studio as Server-Sent Events."""
    repo = repo or get_content_studio_repository()
    settings = get_settings()

    def _sse(payload: Dict[str, Any]) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    project = repo.get_project(ctx, project_id)
    if not project:
        yield _sse({"type": "error", "text": "Project not found"})
        yield "data: [DONE]\n\n"
        return

    brief = _normalize_brief(project.get("brief"))
    artifact_type = str(project.get("artifactType") or brief.get("artifact_type") or "deck")
    brief["artifact_type"] = artifact_type
    title = str(project.get("title") or "Generated content")

    tpl_id = template_id or project.get("templateId")
    chosen_template = repo.get_template(ctx, tpl_id) if tpl_id else None

    try:
        kb_hits = _retrieve_studio_kb_hits(ctx, f"{title} {user_message}")
    except Exception:
        kb_hits = []

    clean_msg = strip_secrets(user_message) if user_message else ""

    # ── Fast-path: explicit generate request (Generate button) ──────────────
    if generate:
        repo.add_message(
            ctx, project_id,
            role="user",
            content={"text": clean_msg or "Generate the content now"},
            turn_type="chat",
        )
        tpl_name = str(chosen_template.get("name") or "template") if chosen_template else "deck"
        yield _sse({"type": "token", "text": f"Generating your {tpl_name}…"})
        try:
            brief = _brief_with_defaults(brief)
            repo.update_project(ctx, project_id, {"brief": brief})
            runtime = get_content_generation_runtime(ctx)
            # Use template-preserving generation when a template is selected
            if chosen_template and str(chosen_template.get("html") or "").strip():
                envelope = _generate_with_template_preservation(
                    ctx,
                    project_id=project_id,
                    project=project,
                    brief=brief,
                    template=chosen_template,
                    clean_msg=clean_msg,
                    repo=repo,
                    settings=settings,
                    runtime=runtime,
                )
            else:
                envelope = _generate_deck_from_plan(
                    ctx,
                    project_id=project_id,
                    project=project,
                    brief=brief,
                    clean_msg=clean_msg,
                    template_id=tpl_id,
                    repo=repo,
                    settings=settings,
                    runtime=runtime,
                )
            result = envelope.result if hasattr(envelope, "result") else {}
            repo.add_message(
                ctx, project_id,
                role="assistant",
                content={"text": str(result.get("message") or "Content generated. Review the preview and make any edits.")},
                turn_type="html",
            )
            yield _sse({
                "type": "revision",
                "revision_id": result.get("revision_id"),
                "html": result.get("html"),
                "template_id": result.get("template_id"),
                "message": result.get("message"),
            })
        except Exception as exc:
            yield _sse({"type": "error", "text": f"Generation failed: {exc}"})
        yield "data: [DONE]\n\n"
        return

    # ── Normal chat turn: stream GPT response ───────────────────────────────
    repo.add_message(ctx, project_id, role="user", content={"text": clean_msg}, turn_type="chat")

    system = _build_chat_system_prompt(
        project=project,
        brief=brief,
        template=chosen_template,
        kb_hits=kb_hits,
    )
    prior_messages = repo.list_messages(ctx, project_id)
    # Exclude the user message we just added (last item) so it goes in as user turn
    history = _messages_to_openai_history(prior_messages[:-1])

    openai_messages: List[Dict[str, Any]] = [{"role": "system", "content": system}]
    openai_messages.extend(history)
    openai_messages.append({"role": "user", "content": clean_msg})

    full_text = ""

    if not settings.openai_api_key:
        fallback = (
            "I'm running in offline mode and need an OpenAI API key to respond intelligently. "
            "Please set OPENAI_API_KEY in your environment and restart the API service."
        )
        yield _sse({"type": "token", "text": fallback})
        full_text = fallback
    else:
        try:
            from openai import OpenAI as _OpenAI
            oai = _OpenAI(api_key=settings.openai_api_key, timeout=90.0)
            stream = oai.chat.completions.create(
                model="gpt-5.4-mini",
                messages=openai_messages,
                stream=True,
                max_completion_tokens=2048,
                temperature=0.72,
            )
            for chunk in stream:
                delta = (chunk.choices[0].delta.content or "") if chunk.choices else ""
                if delta:
                    full_text += delta
                    yield _sse({"type": "token", "text": delta})
        except Exception as exc:
            err = f"Agent error: {exc}"
            yield _sse({"type": "error", "text": err})
            full_text = err

    # Save clean assistant message (strip signal tags for stored text)
    display_text = re.sub(r"<generate_now\s*/>", "", full_text).strip()
    display_text = re.sub(r"<update_slide[^>]*>.*?</update_slide>", "", display_text, flags=re.DOTALL).strip()
    repo.add_message(ctx, project_id, role="assistant", content={"text": display_text}, turn_type="chat")

    # Update brief from the chat context
    if display_text:
        updated_brief = _update_brief_from_reply(brief, display_text)
        if updated_brief != brief:
            repo.update_project(ctx, project_id, {"brief": updated_brief})
            brief = updated_brief

    # ── Detect generation signal ─────────────────────────────────────────────
    has_generate_signal = bool(re.search(r"<generate_now\s*/>", full_text))
    update_match = re.search(
        r"<update_slide\s+n=[\"']?(\d+)[\"']?[^>]*>(.*?)</update_slide>",
        full_text,
        re.DOTALL | re.IGNORECASE,
    )

    if has_generate_signal:
        try:
            brief = _brief_with_defaults(brief)
            repo.update_project(ctx, project_id, {"brief": brief})
            runtime = get_content_generation_runtime(ctx)
            # Use template-preserving generation when a template is selected
            if chosen_template and str(chosen_template.get("html") or "").strip():
                envelope = _generate_with_template_preservation(
                    ctx,
                    project_id=project_id,
                    project=project,
                    brief=brief,
                    template=chosen_template,
                    clean_msg=clean_msg,
                    repo=repo,
                    settings=settings,
                    runtime=runtime,
                )
            else:
                envelope = _generate_deck_from_plan(
                    ctx,
                    project_id=project_id,
                    project=project,
                    brief=brief,
                    clean_msg=clean_msg,
                    template_id=tpl_id,
                    repo=repo,
                    settings=settings,
                    runtime=runtime,
                )
            result = envelope.result if hasattr(envelope, "result") else {}
            yield _sse({
                "type": "revision",
                "revision_id": result.get("revision_id"),
                "html": result.get("html"),
                "template_id": result.get("template_id"),
                "message": result.get("message"),
            })
        except Exception as exc:
            yield _sse({"type": "error", "text": f"Generation failed: {exc}"})

    elif update_match:
        slide_num = int(update_match.group(1))
        update_desc = update_match.group(2).strip()
        try:
            latest = repo.latest_revision(ctx, project_id)
            if latest and settings.openai_api_key:
                current_html = str(latest.get("html") or "")
                slide_pat = re.compile(
                    rf'(<section[^>]*data-slide=["\']?{slide_num}["\']?[^>]*>)(.*?)(</section>)',
                    re.DOTALL | re.IGNORECASE,
                )
                slide_match = slide_pat.search(current_html)
                current_slide_html = slide_match.group(0) if slide_match else ""

                from openai import OpenAI as _OpenAI
                oai = _OpenAI(api_key=settings.openai_api_key, timeout=60.0)
                patch_resp = oai.chat.completions.create(
                    model="gpt-5.4-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are an HTML slide editor. "
                                "Return ONLY the updated <section class=\"slide\" data-slide=\"N\"> ... </section> HTML. "
                                "No explanation, no markdown fences, just the section element."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Current slide HTML:\n{current_slide_html}\n\n"
                                f"Change instruction: {update_desc}\n\n"
                                "Return the updated section HTML only."
                            ),
                        },
                    ],
                    max_completion_tokens=1024,
                    temperature=0.5,
                )
                new_slide_html = (patch_resp.choices[0].message.content or "").strip()
                if new_slide_html and "<section" in new_slide_html.lower():
                    if slide_match:
                        merged_html = slide_pat.sub(new_slide_html, current_html, count=1)
                    else:
                        merged_html = current_html + "\n" + new_slide_html
                    rev = repo.create_revision(
                        ctx, project_id,
                        html=merged_html,
                        citations=latest.get("citations") or [],
                        template_id=tpl_id,
                    )
                    repo.update_project(ctx, project_id, {"status": "preview"})
                    yield _sse({
                        "type": "revision",
                        "revision_id": rev["id"],
                        "html": merged_html,
                        "template_id": tpl_id,
                    })
        except Exception as exc:
            yield _sse({"type": "error", "text": f"Slide update failed: {exc}"})

    yield "data: [DONE]\n\n"


# ──────────────────────────────────────────────────────────────────────────────
# Template-preserving generation helpers
# ──────────────────────────────────────────────────────────────────────────────

def _strip_data_urls(html: str) -> Tuple[str, Dict[str, str]]:
    """Replace long base64 data: URIs with short placeholders to reduce LLM context."""
    placeholders: Dict[str, str] = {}
    counter: List[int] = [0]

    def _sub(m: re.Match) -> str:  # type: ignore[type-arg]
        key = f"__DURL_{counter[0]}__"
        placeholders[key] = m.group(0)
        counter[0] += 1
        return key

    stripped = re.sub(
        r'data:[a-z][a-z0-9!#$&\-^_]*/[a-z0-9\-+.]+;base64,[A-Za-z0-9+/=]{40,}',
        _sub,
        html,
    )
    return stripped, placeholders


def _restore_data_urls(html: str, placeholders: Dict[str, str]) -> str:
    for key, value in placeholders.items():
        html = html.replace(key, value)
    return html


def _extract_template_slide_sections(template_html: str) -> List[str]:
    """Return each <section data-slide="N"> element from a template document."""
    pattern = re.compile(
        r'<section[^>]*\bdata-slide=["\']?\d+["\']?[^>]*>.*?</section>',
        re.DOTALL | re.IGNORECASE,
    )
    return [m.group(0) for m in pattern.finditer(template_html)]


def _extract_template_head(template_html: str) -> str:
    """Extract everything inside <head> (styles, meta, etc.)."""
    m = re.search(r'<head[^>]*>(.*?)</head>', template_html, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _describe_slide_slots(slide_html: str) -> str:
    """Return a compact description of what text slots a slide exposes."""
    parts: List[str] = []
    if re.search(r'data-role=["\']heading["\']|class=["\'][^"\']*(?:slide-title|title-text)\b', slide_html, re.I):
        parts.append("heading")
    if re.search(r'class=["\'][^"\']*(?:slide-kicker|eyebrow|slot-label|section-marker)\b', slide_html, re.I):
        parts.append("kicker")
    if re.search(r'data-role=["\']body["\']|class=["\'][^"\']*slide-body\b', slide_html, re.I):
        parts.append("body")
    if re.search(r'<h[12]\b', slide_html, re.I) and "heading" not in parts:
        parts.append("heading(h1/h2)")
    if re.search(r'<p\b', slide_html, re.I) and "body" not in parts:
        parts.append("body(p)")
    if re.search(r'<ul\b|<ol\b', slide_html, re.I):
        parts.append("bullets")
    return ", ".join(parts) if parts else "decorative"


def _replace_first_element_text(
    html: str, opening_pattern: str, new_text: str
) -> Tuple[str, bool]:
    """Find the first element whose opening tag matches ``opening_pattern``
    and replace its inner text, preserving the opening/closing tags themselves."""
    m = re.search(opening_pattern, html, re.IGNORECASE)
    if not m:
        return html, False
    tag_m = re.match(r"<(\w+)", m.group(0))
    if not tag_m:
        return html, False
    tag = tag_m.group(1)
    after = html[m.end():]
    close = f"</{tag}>"
    close_pos = after.lower().find(close.lower())
    if close_pos < 0:
        return html, False
    escaped = html_lib.escape(new_text)
    return html[: m.end()] + escaped + html[m.end() + close_pos :], True


def _inject_slide_content(slide_html: str, content: Dict[str, Any], slide_num: int) -> str:
    """Inject generated text into a template slide's text slots.
    All HTML structure, classes, inline styles, images, and decorative elements
    are preserved exactly — only visible text is changed."""
    heading = str(content.get("heading") or "").strip()
    kicker = str(content.get("kicker") or "").strip()
    body = str(content.get("body") or "").strip()
    subheading = str(content.get("subheading") or "").strip()
    bullets = [str(b).strip() for b in (content.get("bullets") or []) if str(b).strip()]

    result = slide_html

    # Kicker / label — try all common class names used by templates
    if kicker:
        replaced = False
        for kicker_pattern in [
            r'<[^>]+class=["\'][^"\']*slide-kicker[^"\']*["\'][^>]*>',
            r'<[^>]+class=["\'][^"\']*\beyebrow\b[^"\']*["\'][^>]*>',
            r'<[^>]+class=["\'][^"\']*\bslot-label\b[^"\']*["\'][^>]*>',
            r'<[^>]+class=["\'][^"\']*\bsection-marker\b[^"\']*["\'][^>]*>',
        ]:
            result, replaced = _replace_first_element_text(result, kicker_pattern, kicker)
            if replaced:
                break

    # Heading — data-role="heading" → h1 → h2
    if heading:
        replaced = False
        result, replaced = _replace_first_element_text(
            result, r'<[^>]+data-role=["\']heading["\'][^>]*>', heading
        )
        if not replaced:
            result, replaced = _replace_first_element_text(result, r"<h1[^>]*>", heading)
        if not replaced:
            result, _ = _replace_first_element_text(result, r"<h2[^>]*>", heading)

    # Body — data-role="body" → class slide-body → first <p>
    body_text = body or subheading
    if body_text:
        replaced = False
        result, replaced = _replace_first_element_text(
            result, r'<[^>]+data-role=["\']body["\'][^>]*>', body_text
        )
        if not replaced:
            result, replaced = _replace_first_element_text(
                result, r'<[^>]+class=["\'][^"\']*slide-body[^"\']*["\'][^>]*>', body_text
            )
        if not replaced:
            result, _ = _replace_first_element_text(result, r"<p[^>]*>", body_text)

    # Bullets
    if bullets:
        li_html = "".join(f"<li>{html_lib.escape(b)}</li>" for b in bullets[:8])
        result = re.sub(
            r"(<(?:ul|ol)[^>]*>).*?(</(?:ul|ol)>)",
            rf"\g<1>{li_html}\2",
            result,
            count=1,
            flags=re.DOTALL | re.IGNORECASE,
        )

    return result


def _parse_slide_content_json(text: str, expected_count: int) -> Dict[int, Dict[str, Any]]:
    """Parse the slide content JSON returned by the LLM."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\s*```$", "", text).strip()

    data: Any = None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                return {}

    if not isinstance(data, dict):
        return {}

    slides_list = data.get("slides") or []
    if not isinstance(slides_list, list):
        return {}

    out: Dict[int, Dict[str, Any]] = {}
    for i, item in enumerate(slides_list, start=1):
        if isinstance(item, dict):
            num = int(item.get("slide") or i)
            out[num] = item
    return out


def _generate_with_template_preservation(
    ctx: TenantContext,
    *,
    project_id: str,
    project: Dict[str, Any],
    brief: Dict[str, Any],
    template: Dict[str, Any],
    clean_msg: str,
    repo: ContentStudioRepository,
    settings: Any,
    runtime: Dict[str, Any],
) -> AgentEnvelope:
    """Generate a deck by filling AI content INTO the template's existing slide HTML.
    Backgrounds, logos, images, layout, and all CSS are 100% preserved.
    Only heading / body / kicker / bullet text slots are updated."""
    tpl_id = str(template.get("id") or "")
    tpl_html = str(template.get("html") or "")
    title = str(project.get("title") or "Generated Deck")
    audience = str(brief.get("audience") or "Executive stakeholders").strip()
    context_str = str(brief.get("content_context") or brief.get("style") or "B2B sales enablement").strip()
    raw_points = brief.get("pain_points_coverage") or brief.get("key_points") or []
    points: List[str] = [str(p).strip() for p in (raw_points if isinstance(raw_points, list) else []) if str(p).strip()]

    # KB context
    try:
        kb_hits, citations = _retrieve_studio_evidence(
            ctx, project=project, brief=brief, user_message=clean_msg, settings=settings
        )
    except Exception:
        kb_hits, citations = [], []
    if not citations:
        citations = _brief_citations(project_id, brief)

    # Extract slides from template
    slide_sections = _extract_template_slide_sections(tpl_html)
    slide_count = len(slide_sections)

    if slide_count == 0:
        # No parseable sections → fall back to standard generation
        return _generate_deck_from_plan(
            ctx,
            project_id=project_id,
            project=project,
            brief=brief,
            clean_msg=clean_msg,
            template_id=tpl_id,
            repo=repo,
            settings=settings,
            runtime=runtime,
        )

    head_content = _extract_template_head(tpl_html)

    # Strip data URLs from slide HTML before sending to LLM.
    # IMPORTANT: use a single counter across all slides so each placeholder key
    # is unique — if we reset to 0 per slide, slide 2+ overwrite slide 1's
    # entries in all_placeholders and the wrong background gets restored.
    stripped_sections: List[str] = []
    all_placeholders: Dict[str, str] = {}
    _global_counter: List[int] = [0]

    def _strip_section(html: str) -> str:
        ph = all_placeholders  # share the same dict
        counter = _global_counter

        def _sub(m: re.Match) -> str:  # type: ignore[type-arg]
            key = f"__DURL_{counter[0]}__"
            ph[key] = m.group(0)
            counter[0] += 1
            return key

        return re.sub(
            r'data:[a-z][a-z0-9!#$&\-^_]*/[a-z0-9\-+.]+;base64,[A-Za-z0-9+/=]{40,}',
            _sub,
            html,
        )

    for sec in slide_sections:
        stripped_sections.append(_strip_section(sec))

    slide_descriptions = "\n".join(
        f"  Slide {i + 1}: {_describe_slide_slots(sec)}"
        for i, sec in enumerate(stripped_sections)
    )
    kb_text = "\n".join(
        f"  - {str(h.get('title') or 'KB doc')}: {str(h.get('chunk_text') or '')[:120]}"
        for h in kb_hits[:4]
    ) or "  (none)"
    points_text = "; ".join(points[:5]) if points else f"Key benefits and value of {title}"

    content_prompt = (
        f"Generate slide content for a B2B sales enablement deck titled '{title}' with {slide_count} slides.\n\n"
        f"Context:\n"
        f"  Project title: {title}\n"
        f"  Audience: {audience}\n"
        f"  Key messages: {points_text}\n"
        f"  Style / context: {context_str}\n"
        f"  KB sources:\n{kb_text}\n\n"
        f"Template slide structure (what text slots each slide has):\n{slide_descriptions}\n\n"
        "Rules:\n"
        "  - Slide 1 is typically a cover/title slide — use a short punchy headline\n"
        "  - Last slide is typically next steps or CTA\n"
        "  - kicker = 2-4 word category label (e.g. 'The Problem', 'Our Approach')\n"
        "  - heading = concise slide title, max 10 words\n"
        "  - body = 1-2 sentence description (omit for decorative slides)\n"
        "  - bullets = short phrases, max 4, only if slide structure has a bullet list\n"
        "  - For 'decorative' slides include the entry but leave fields empty/null\n\n"
        f"Return ONLY this JSON with exactly {slide_count} slides (no markdown, no explanation):\n"
        '{"slides": [{"slide": 1, "kicker": "...", "heading": "...", "subheading": "...", "body": "...", "bullets": []}]}'
    )

    completion = LlmClient(openai_api_key=settings.openai_api_key or None).complete(
        system=(
            "You are a B2B sales content expert. "
            "Generate structured slide content as compact JSON. "
            "Focus on executive clarity and business impact."
        ),
        user=content_prompt,
        max_tokens=3000,
        model="gpt-5.4-mini",
        fallback_model="gpt-5.4-mini",
    )

    slide_contents = _parse_slide_content_json(completion.text, slide_count)

    # Inject content into each template slide, restoring data URLs afterwards
    filled_sections: List[str] = []
    for i, (orig_sec, stripped_sec) in enumerate(zip(slide_sections, stripped_sections), start=1):
        content = slide_contents.get(i) or {}
        if content:
            filled_stripped = _inject_slide_content(stripped_sec, content, i)
            filled = _restore_data_urls(filled_stripped, all_placeholders)
        else:
            filled = orig_sec  # decorative slide — keep exactly as the template
        filled_sections.append(filled)

    # Reassemble full document preserving template styles
    body_html = "\n".join(filled_sections)
    full_html = (
        "<!DOCTYPE html><html>"
        f"<head><meta charset='utf-8'>{head_content}</head>"
        "<body style='margin:0;padding:0;background:#e8eef7;'>"
        f"<div style='display:flex;flex-direction:column;gap:0;'>{body_html}</div>"
        "</body></html>"
    )

    tpl_name = str(template.get("name") or "template")
    message = (
        f"Generated {slide_count} slides using the {tpl_name} template. "
        "The layout, colors, backgrounds, and logos are all preserved from the template — "
        "only the content has been filled in. Let me know what you'd like to change."
    )

    rev = repo.create_revision(
        ctx,
        project_id,
        html=full_html,
        citations=[c.model_dump() for c in citations],
        template_id=tpl_id,
    )
    repo.update_project(ctx, project_id, {"status": "preview", "templateId": tpl_id, "brief": brief})

    envelope = AgentEnvelope(
        agent="content_generation",
        operation="html_generate",
        result={
            "project_id": project_id,
            "turn_type": "html",
            "message": message,
            "revision_id": rev["id"],
            "html": full_html,
            "template_id": tpl_id,
        },
        citations=citations,
        confidence=0.92,
        cost={
            "tokens": completion.tokens_in + completion.tokens_out,
            "usd": completion.cost_usd,
            "model": completion.model,
        },
        trace_id=completion.trace_id,
        creative=True,
    )
    validate_envelope(envelope)
    return envelope
