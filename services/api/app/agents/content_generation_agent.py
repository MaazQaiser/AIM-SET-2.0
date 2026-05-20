from __future__ import annotations

import json
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
                    "ask": _questions_for_missing(missing),
                },
                citations=[],
                confidence=0.75,
                cost={"tokens": 0, "usd": 0.0, "model": "rule-based-brief-capture"},
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
                "ask": ["Requirements captured. Click \"Generate slides\" to create the first draft."],
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

    system = runtime["system_prompt"]
    user_payload = (
        f"Project: {project.get('title')}\n"
        f"Artifact type: {project.get('artifactType')}\n"
        f"Brief: {json.dumps(brief)}\n"
        f"Template selected: {tpl_id or 'none'}\n"
        f"Template CSS variables: {(chosen_template or {}).get('cssVariables', {})}\n"
        f"Available templates: {json.dumps([{'id': t['id'], 'name': t['name'], 'type': t['artifactType']} for t in templates[:20]])}\n"
        f"KB hits: {hits[:5]}\n"
        f"Chat history:\n" + "\n".join(history_lines) + "\n"
        f"Latest user message: {clean_msg}"
    )

    api_key = settings.anthropic_api_key or None
    completion = LlmClient(api_key=api_key).complete(
        system=system,
        user=user_payload,
        max_tokens=4096,
        model=runtime["model_name"],
        fallback_model=runtime["fallback_model_name"],
    )

    raw = completion.text
    if "fallback" in completion.model:
        envelope = AgentEnvelope(
            agent="content_generation",
            operation="studio_ask",
            result={
                "project_id": project_id,
                "turn_type": "ask",
                "ask": [
                    "What deliverable do you need (deck, one-pager, or image)?",
                    "Who is the audience?",
                    "What are the 3 key points to include?",
                ],
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
            next_questions = ["Requirements captured. Click \"Generate slides\" to create the first draft."]
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
    return (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
        f"<style>{vars_css}{base_style}</style></head><body>{body}</body></html>"
    )


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
    style = str(brief.get("style", "persuasive")).strip().capitalize()
    points = brief.get("key_points")
    if not isinstance(points, list) or not points:
        points = [
            "Current challenge and business impact",
            "Proposed approach and expected outcomes",
            "Roadmap, risks, and next steps",
        ]
    bullets = "".join(f"<li>{str(p)}</li>" for p in points[:5])

    if artifact_type == "one_pager":
        body = f"""
        <article style="max-width:960px;margin:0 auto;padding:48px;font-family:Arial,sans-serif;">
          <h1>{title}</h1>
          <p><strong>Audience:</strong> {audience}</p>
          <p><strong>Style:</strong> {style}</p>
          <h2>Key Points</h2>
          <ul>{bullets}</ul>
        </article>
        """
    elif artifact_type == "image":
        body = f"""
        <figure style="width:1280px;height:720px;margin:0 auto;padding:40px;display:flex;flex-direction:column;justify-content:center;background:#f7fafc;font-family:Arial,sans-serif;">
          <h1 style="font-size:56px;line-height:1.1;margin:0 0 16px;">{title}</h1>
          <figcaption style="font-size:28px;color:#4a5568;">{audience} · {style}</figcaption>
        </figure>
        """
    else:
        body = f"""
        <section class="slide" data-slide="1" style="width:1280px;height:720px;margin:0 auto;padding:48px;font-family:Arial,sans-serif;background:#ffffff;">
          <h1 style="font-size:48px;line-height:1.15;margin:0 0 12px;">{title}</h1>
          <p style="font-size:24px;color:#4a5568;margin:0 0 24px;">Audience: {audience}</p>
          <ul style="font-size:28px;line-height:1.35;">{bullets}</ul>
        </section>
        <section class="slide" data-slide="2" style="width:1280px;height:720px;margin:0 auto;padding:48px;font-family:Arial,sans-serif;background:#f8fafc;">
          <h2 style="font-size:42px;margin:0 0 20px;">Approach</h2>
          <p style="font-size:26px;">Style: {style}</p>
          <p style="font-size:22px;color:#4a5568;">Use this draft as a base; refine content from chat and template selection.</p>
        </section>
        <section class="slide" data-slide="3" style="width:1280px;height:720px;margin:0 auto;padding:48px;font-family:Arial,sans-serif;background:#ffffff;">
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


def _missing_brief_fields(brief: Dict[str, Any]) -> List[str]:
    missing: List[str] = []
    if not str(brief.get("audience", "")).strip():
        missing.append("audience")
    points = brief.get("key_points")
    if not isinstance(points, list) or len([p for p in points if str(p).strip()]) < 3:
        missing.append("key_points")
    if not str(brief.get("style", "")).strip():
        missing.append("style")
    return missing


def _questions_for_missing(missing: List[str]) -> List[str]:
    out: List[str] = []
    if "audience" in missing:
        out.append("Who is the audience?")
    if "key_points" in missing:
        out.append("What are the 3 key points to include?")
    if "style" in missing:
        out.append("Do you want a persuasive, educational, or summary style?")
    return out[:3]


def _brief_with_defaults(brief: Dict[str, Any]) -> Dict[str, Any]:
    b = dict(brief)
    b["audience"] = str(b.get("audience", "")).strip() or "Executive stakeholders"
    points = b.get("key_points")
    if not isinstance(points, list) or len([p for p in points if str(p).strip()]) < 3:
        b["key_points"] = [
            "Current challenge and why it matters",
            "Recommended approach and expected outcomes",
            "Roadmap with risks and next steps",
        ]
    b["style"] = str(b.get("style", "")).strip() or "persuasive"
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

    # Users often paste the prompt + answer together; keep only the answer.
    if low.startswith("who is the audience?"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()
    elif low.startswith("what are the 3 key points to include?"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()
    elif low.startswith("do you want a persuasive, educational, or summary style?"):
        raw = raw.split("?", 1)[1].strip().strip('"').strip()
        low = raw.lower()

    if low in {"persuasive", "educational", "summary"}:
        b["style"] = low
        return b

    if low.startswith("audience:"):
        b["audience"] = raw.split(":", 1)[1].strip()
        return b
    if low.startswith("style:"):
        b["style"] = raw.split(":", 1)[1].strip().lower()
        return b
    if low.startswith("key points:") or low.startswith("keypoints:"):
        b["key_points"] = _extract_key_points(raw.split(":", 1)[1])
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
    if "key_points" in missing and _looks_like_key_points(raw):
        b["key_points"] = _extract_key_points(raw)
        return b
    if "style" in missing:
        if any(k in low for k in ["persuasive", "educational", "summary", "executive", "technical"]):
            b["style"] = raw.lower()
            return b
    return b
