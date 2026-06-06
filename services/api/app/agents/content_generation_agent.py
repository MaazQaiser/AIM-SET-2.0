from __future__ import annotations

import json
import html as html_lib
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

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
            next_item["citation_source"] = kb_sources[index % len(kb_sources)]
            snippet = str(kb_hits[index % len(kb_hits)].get("chunk_text") or "").strip()
            if snippet:
                next_item["evidence"] = snippet[:180]
        else:
            next_item["citation_source"] = f"session:{project_id}"
        out.append(next_item)
    return out


def _brief_citations(project_id: str, brief: Dict[str, Any]) -> List[Citation]:
    snippets = []
    for key in ("audience", "content_context", "style"):
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

    kb_hits = _retrieve_studio_kb_hits(ctx, f"{title} {brief.get('needed_for', '')} {brief.get('generation_reason', '')}")
    if kb_hits:
        brief["kb_asset_ids"] = [str(hit.get("asset_id", "")) for hit in kb_hits[:5] if hit.get("asset_id")]

    if artifact_type == "deck" and _needs_slide_outline(brief, artifact_type):
        brief["slide_outline"] = _build_slide_outline(title=title, brief=brief)
        brief["slide_outline"] = _attach_outline_sources(
            brief["slide_outline"],
            project_id=project_id,
            kb_hits=kb_hits,
        )

    best_template, recommendations = _pick_default_templates(ctx, repo, project, brief, title)
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
    )
    result: Dict[str, Any] = {
        "project_id": project_id,
        "turn_type": "outline",
        "message": message,
    }
    if brief.get("slide_outline"):
        result["slide_outline"] = brief["slide_outline"]
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
        citations=_hits_to_citations(kb_hits),
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
            brief["slide_outline"] = _build_slide_outline(
                title=str(project.get("title") or "Generated Deck"),
                brief=brief,
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
            envelope = AgentEnvelope(
                agent="content_generation",
                operation="studio_ask",
                result={
                    "project_id": project_id,
                    "turn_type": "ask",
                    "message": "Updated the slide plan. Tell me any other slide edits, or click Generate when it looks right.",
                    "slide_outline": brief.get("slide_outline") or [],
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
        tpl_id = template_id or project.get("templateId")
        chosen_template = repo.get_template(ctx, tpl_id) if tpl_id else None
        kb_hits, citations = _retrieve_studio_evidence(
            ctx,
            project=project,
            brief=brief,
            user_message=clean_msg,
            settings=settings,
        )
        if not citations:
            citations = _brief_citations(project_id, brief)
        if isinstance(brief.get("slide_outline"), list):
            brief["slide_outline"] = _attach_outline_sources(
                brief["slide_outline"],
                project_id=project_id,
                kb_hits=kb_hits,
            )
        full_html = _build_slide_preview_html(
            title=str(project.get("title") or "Generated Deck"),
            brief=brief,
            template=chosen_template,
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
            citations=[c.model_dump() for c in citations],
            template_id=tpl_id,
        )
        patch: Dict[str, Any] = {"brief": brief, "status": "preview"}
        if tpl_id:
            patch["templateId"] = tpl_id
        repo.update_project(ctx, project_id, patch)
        envelope = AgentEnvelope(
            agent="content_generation",
            operation="html_generate",
            result={
                "project_id": project_id,
                "turn_type": "html",
                "message": "Draft is ready in the preview. Tell me which slide to edit and I will update it from chat.",
                "revision_id": rev["id"],
                "html": full_html,
                "template_id": tpl_id,
            },
            citations=citations,
            confidence=0.9 if kb_hits else 0.78,
            cost={"tokens": 0, "usd": 0.0, "model": "rule-based-slide-preview"},
            trace_id=str(uuid.uuid4()),
            creative=not bool(kb_hits),
        )
        validate_envelope(envelope)
        return envelope

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

    api_key = settings.llm_api_key or None
    completion = LlmClient(api_key=api_key).complete(
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
) -> str:
    account = str(brief.get("account_name") or "").strip()
    needed_for = str(brief.get("needed_for") or "").strip()
    lines = ["I pulled context from your content suggestion and drafted a starting plan."]
    if account and needed_for:
        lines.append(f"Account: {account}. Needed for: {needed_for}.")
    elif needed_for:
        lines.append(f"Needed for: {needed_for}.")
    elif account:
        lines.append(f"Account: {account}.")

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


def _build_slide_outline(title: str, brief: Dict[str, Any]) -> List[Dict[str, Any]]:
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
    outline.append(
        {
            "slide": 1,
            "heading": title,
            "body": f"Set the context for {audience} and frame why this conversation matters now.",
            "visual": "Account logo or relevant hero image",
        }
    )

    middle_slots = max(0, count - 2)
    for index in range(middle_slots):
        point = clean_points[index % len(clean_points)]
        outline.append(
            {
                "slide": index + 2,
                "heading": point[:72],
                "body": f"Explain the pain point, business impact, and what the audience needs to believe. Context: {context}.",
                "visual": "Pain-impact chart or workflow diagram",
            }
        )

    if count > 1:
        outline.append(
            {
                "slide": count,
                "heading": "Recommended next steps",
                "body": "Summarize the proposed path, ownership, and the next decision the buyer should make.",
                "visual": "Timeline or next-step checklist",
            }
        )

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
        slides.append(
            f"""
            <section class="slide dc-slide template-root" data-slide="{slide_num}" data-role="studio-slide">
              <div class="slide-kicker">Slide {slide_num:02d}</div>
              <{title_tag} data-role="heading">{heading} {cite}</{title_tag}>
              <p data-role="body">{body} {cite}</p>
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
