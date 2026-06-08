from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import (
    DEFAULT_CHAT_FALLBACK_MODEL,
    DEFAULT_CHAT_MODEL,
    LlmClient,
    openai_completion_token_kwargs,
    anthropic_tools_to_openai,
)
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.config import get_settings
from app.agents.copilot_surface_contracts import COPILOT_SURFACE_CONTRACTS
from app.domain.calls_service import CallsService
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_repository import get_live_call_repository
from app.domain.memory_store import get_memory_store
from app.domain.content_studio_repository import get_content_studio_repository
from app.services.company_playbook_service import search_company_playbook

SYSTEM_PROMPT = """You are DC Copilot — the company-aware assistant for a discovery-call sales platform.
You are one brain used across Home, Pre-DC, Live DC, Post-DC, Knowledge, Content, and Agent screens.

Operating rules:
- Be accurate, concise, proactive, and evidence-based.
- Ground company/process/project/engagement claims in the supplied context, KB, call brief, transcript, or post-call review.
- If evidence is missing or weak, say what is missing instead of inventing.
- Prefer concrete next actions, exact talk tracks, and short bullets over generic advice.
- In Live DC, optimize for what the AE can use right now without derailing the call.
- Format live answers in small sections with blank lines between summary, evidence, and next move.
- When quoting what the customer/prospect said, italicize the quoted text in markdown.
- When listing pointers, put each pointer on its own markdown bullet line.
- End every answer with a concise question that offers the user a useful next Copilot action.
- Keep source wording product-safe: say transcript, call data, pre-call brief, post-call review, or company knowledge base. Do not expose internal database, stack, or retrieval mechanics.
- Do not claim an action was executed unless a tool result says it was.
- When suggesting workflow actions, frame them as recommendations unless explicitly asked to run/export/generate.

You have tools to search the knowledge base, list and inspect calls, read transcripts,
trigger backend agents, and export call summaries."""

SURFACE_GUIDANCE: Dict[str, str] = {
    "home": "Focus on agenda, upcoming calls, missing briefs, and priorities.",
    "pre_dc": "Focus on call prep, BANT gaps, discovery questions, objections, and KB proof.",
    "live_dc": "Focus on next-best question, objection handling, BANT coverage, proof points, and concise coaching.",
    "post_dc": "Focus on recap, open gaps, next steps, Jira handoff, and client-safe messaging.",
    "knowledge": "Focus on finding, comparing, and explaining KB assets with citations.",
    "content": "Focus on content gaps, project drafts, templates, case studies, and reusable assets.",
    "agents": "Focus on agent status, agent outputs, and when to run workflows.",
    "settings": "Focus on setup, integrations, imports, and operational troubleshooting.",
    "global": "Use the current page and user question to choose the most relevant help.",
}

MAX_TOOL_ITERATIONS = 3

TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "name": "search_knowledge_base",
        "description": "Semantic search over tenant knowledge base (documents, battlecards, case studies).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "integer", "description": "Max chunks", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_calls",
        "description": "List discovery calls for this tenant, optionally filtered by status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "upcoming | live | completed | no-show",
                },
                "limit": {"type": "integer", "default": 20},
            },
        },
    },
    {
        "name": "get_call_details",
        "description": "Full call record plus brief and live signals if available.",
        "input_schema": {
            "type": "object",
            "properties": {"call_id": {"type": "string"}},
            "required": ["call_id"],
        },
    },
    {
        "name": "get_call_transcript",
        "description": "Recent transcript segments for a call.",
        "input_schema": {
            "type": "object",
            "properties": {
                "call_id": {"type": "string"},
                "last_n": {"type": "integer", "default": 40},
            },
            "required": ["call_id"],
        },
    },
    {
        "name": "dispatch_agent",
        "description": (
            "Run a backend agent: pre_dc_brief, pre_dc_pipeline, relevant_content, "
            "post_call, call_end, kb_ingest (metadata only)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {"type": "string"},
                "call_id": {"type": "string"},
                "params": {"type": "object"},
            },
            "required": ["agent_name", "call_id"],
        },
    },
    {
        "name": "export_call_summary",
        "description": "Export call brief + transcript as json or markdown for download.",
        "input_schema": {
            "type": "object",
            "properties": {
                "call_id": {"type": "string"},
                "format": {"type": "string", "enum": ["json", "markdown"], "default": "json"},
            },
            "required": ["call_id"],
        },
    },
]

DISPATCHABLE_AGENTS = [
    {
        "id": "pre_dc_brief",
        "name": "Pre-DC Brief",
        "description": "Generate or refresh the pre-discovery call brief for a call.",
    },
    {
        "id": "pre_dc_pipeline",
        "name": "Pre-DC Pipeline",
        "description": "Full workflow pipeline (summary, artifacts, relevant content) from DC notes.",
    },
    {
        "id": "relevant_content",
        "name": "Relevant Content",
        "description": "Load KB-matched documents and projects for the call account.",
    },
    {
        "id": "post_call",
        "name": "Post-Call Pipeline",
        "description": "Run task + coaching agents after a call ends.",
    },
    {
        "id": "call_end",
        "name": "End Live Call",
        "description": "Finalize live session and trigger post-call handling.",
    },
    {
        "id": "kb_ingest",
        "name": "KB Metadata Ingest",
        "description": "Register KB asset metadata (file upload uses separate upload API).",
    },
]


def list_dispatchable_agents() -> List[Dict[str, str]]:
    return DISPATCHABLE_AGENTS


def _tenant_kb_search(ctx: TenantContext, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    settings = get_settings()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    repo = get_kb_repository()

    def vector_search(tid: str, embedding: List[float], lim: int) -> List[Dict[str, Any]]:
        return repo.match_chunks(tenant_uuid, embedding, limit=lim, clerk_key=clerk_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    return retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=get_memory_store().kb_chunks.get(clerk_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )


def _kb_search(ctx: TenantContext, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    tenant_hits = _tenant_kb_search(ctx, query, limit=limit)
    playbook_hits = search_company_playbook(query, limit=limit)
    if not playbook_hits:
        return tenant_hits

    combined = [*tenant_hits, *playbook_hits]
    combined.sort(key=lambda hit: float(hit.get("score") or 0), reverse=True)
    return combined[: max(limit, 1)]


def _compact_json(value: Any, limit: int = 1600) -> str:
    text = json.dumps(value or {}, default=str, ensure_ascii=False)
    return text[:limit]


def _field_excerpt(value: Any, limit: int = 220) -> str:
    if value is None:
        return ""
    text = str(value).replace("\n", " ").strip()
    return text[:limit]


def _call_label(call: Optional[Dict[str, Any]], call_id: str) -> str:
    if not call:
        return call_id
    account = call.get("accountName") or call.get("account_name") or call_id
    lead = call.get("leadName") or call.get("leadTitle")
    return f"{account} ({lead})" if lead else str(account)


def _transcript_excerpt(events: List[Dict[str, Any]], limit: int = 18) -> str:
    lines: List[str] = []
    for ev in events[-limit:]:
        speaker = ev.get("speaker_name") or ev.get("speaker_id") or ev.get("speakerRole") or "Speaker"
        role = ev.get("speaker_role") or ev.get("speakerRole")
        label = f"{speaker}/{role}" if role else str(speaker)
        text = _field_excerpt(ev.get("text"), 260)
        if text:
            lines.append(f"- {label}: {text}")
    return "\n".join(lines)


def _kb_context_lines(hits: List[Dict[str, Any]], limit: int = 5) -> str:
    lines: List[str] = []
    for hit in hits[:limit]:
        title = hit.get("title") or hit.get("asset_id") or "KB asset"
        snippet = _field_excerpt(hit.get("chunk_text") or hit.get("summary") or hit.get("description"), 260)
        if snippet:
            lines.append(f"- {title}: {snippet}")
    return "\n".join(lines)


def _money_or_dash(value: Any) -> str:
    text = _field_excerpt(value, 80)
    return text or "not captured"


def _call_schedule(call: Dict[str, Any]) -> str:
    date = call.get("discoveryCallDatePkt")
    time = call.get("discoveryCallTimePkt")
    if date or time:
        return " ".join(str(part) for part in (date, time) if part)
    return _field_excerpt(call.get("scheduledAt"), 120) or "schedule not captured"


def _bant_gap_labels(bant: Optional[Dict[str, Any]]) -> List[str]:
    if not isinstance(bant, dict):
        return ["budget", "authority", "need", "timeline"]
    gaps: List[str] = []
    for key in ("budget", "authority", "need", "timeline"):
        status = str(bant.get(key) or "unknown").lower()
        if status != "confirmed":
            gaps.append(key)
    return gaps


def _bullet_lines(values: List[Any], *, key: Optional[str] = None, limit: int = 3) -> List[str]:
    lines: List[str] = []
    for value in values[:limit]:
        item = value.get(key) if key and isinstance(value, dict) else value
        text = _field_excerpt(item, 220)
        if text:
            lines.append(f"- {text}")
    return lines


def _is_plain_pointer_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if len(stripped) > 180:
        return False
    if stripped.startswith(("-", "* ", "•", ">", "|", "#", "```")):
        return False
    if re.match(r"^\d+[\.)]\s+", stripped):
        return False
    if stripped.startswith("**") or stripped.startswith("_"):
        return False
    if stripped.lower().startswith(("if you want", "want me", "do you want", "would you like")):
        return False
    if stripped.endswith(":"):
        return False
    if stripped.endswith(("?", "!")):
        return False
    if stripped.endswith(".") and len(stripped) > 120:
        return False
    return bool(re.search(r"[A-Za-z]", stripped))


def _bulletize_pointer_runs(answer: str) -> str:
    lines = answer.splitlines()
    out: List[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        out.append(line)
        if not line.strip().endswith(":"):
            index += 1
            continue

        cursor = index + 1
        prefix_blanks: List[str] = []
        pointers: List[str] = []
        trailing_blanks: List[str] = []
        while cursor < len(lines):
            candidate = lines[cursor]
            if not candidate.strip():
                if pointers:
                    trailing_blanks.append(candidate)
                else:
                    prefix_blanks.append(candidate)
                cursor += 1
                continue
            if not _is_plain_pointer_line(candidate):
                break
            pointers.append(candidate.strip())
            trailing_blanks = []
            cursor += 1

        if len(pointers) >= 2:
            out.extend(prefix_blanks[:1] or [""])
            out.extend(f"- {pointer}" for pointer in pointers)
            index = cursor - len(trailing_blanks)
            continue

        index += 1

    return "\n".join(out)


def _italicize_customer_quotes(answer: str) -> str:
    answer = re.sub(r"(?<![*_])“([^”\n]{2,240})”", r"*“\1”*", answer)
    answer = re.sub(r"(?<![*_])\"([^\"\n]{4,240})\"", r"*\"\1\"*", answer)
    return answer


_EVIDENCE_SECTION_RE = re.compile(
    r"^(?:#{1,4}\s*)?(?:\*\*)?(evidence|call evidence|transcript evidence|what i did find):?(?:\*\*)?:?\s*$",
    re.IGNORECASE,
)
_SECTION_HEADING_RE = re.compile(r"^(?:#{1,4}\s+.+|\*\*[^*]+\*\*:?\s*|[A-Z][A-Za-z0-9 /&?.,'-]{2,72}:\s*)$")


def _wrap_evidence_sections(answer: str) -> str:
    lines = answer.splitlines()
    out: List[str] = []
    in_evidence = False
    for line in lines:
        stripped = line.strip()
        if _EVIDENCE_SECTION_RE.match(stripped):
            in_evidence = True
            out.append(line)
            continue

        if in_evidence and stripped and _SECTION_HEADING_RE.match(stripped):
            in_evidence = False

        if in_evidence and stripped and not stripped.startswith(">") and not stripped.startswith("|"):
            out.append(f"> {line}")
        else:
            out.append(line)
    return "\n".join(out)


def _closing_question(surface: str) -> str:
    clean_surface = surface if surface in SURFACE_GUIDANCE else "global"
    if clean_surface == "live_dc":
        return "Want me to turn this into the next live-call question or a one-line talk track?"
    if clean_surface == "pre_dc":
        return "Want me to turn this into an opening question or objection response?"
    if clean_surface == "post_dc":
        return "Want me to draft the client email or Jira handoff next?"
    if clean_surface == "knowledge":
        return "Want me to pull the strongest proof point or compare the closest assets?"
    return "Want me to drill into one call or show the next priority?"


def _ensure_closing_question(answer: str, surface: str) -> str:
    stripped = answer.rstrip()
    if not stripped:
        return _closing_question(surface)
    last_line = next((line.strip() for line in reversed(stripped.splitlines()) if line.strip()), "")
    if last_line.endswith("?"):
        return stripped
    return f"{stripped}\n\n{_closing_question(surface)}"


def _strip_source_footers(answer: str) -> str:
    lines = [
        line
        for line in (answer or "").splitlines()
        if not re.match(r"^\s*(?:\*\*)?sources?:\s*", line.strip(), flags=re.IGNORECASE)
    ]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _polish_copilot_answer(answer: str, *, surface: str) -> str:
    polished = _strip_source_footers(answer or "")
    polished = _italicize_customer_quotes(polished)
    polished = _bulletize_pointer_runs(polished)
    polished = _wrap_evidence_sections(polished)
    return _ensure_closing_question(polished, surface)


def _hits_to_citations(hits: List[Dict[str, Any]]) -> List[Citation]:
    out: List[Citation] = []
    for i, hit in enumerate(hits[:5]):
        source_type = str(hit.get("source_type") or "kb_document")
        raw_score = float(hit.get("score", 0.8) or 0.8)
        confidence = raw_score if raw_score <= 1 else min(raw_score / 10, 0.98)
        out.append(
            Citation(
                source_type=source_type,
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or hit.get("title") or "")[:200],
                confidence=max(confidence, 0.0),
            )
        )
    return out


def _dedupe_citations(citations: List[Citation]) -> List[Citation]:
    out: List[Citation] = []
    seen: set[tuple[str, str, str]] = set()
    for citation in citations:
        key = (
            citation.source_type,
            citation.source_id,
            "" if citation.source_type == "company_playbook" else citation.snippet[:120],
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(citation)
    return out


_PROJECT_TITLE_KEYS = (
    "project name",
    "project",
    "case study",
    "customer project",
    "client project",
    "account name",
    "company name",
    "company",
    "client name",
    "client",
    "customer",
    "opportunity name",
    "name",
    "title",
)

_PROJECT_DETAIL_KEYS = (
    "linkedin industry",
    "industry",
    "linkedin category / sector",
    "category",
    "sector",
    "technical solution",
    "solution",
    "technology",
    "platform",
    "process",
    "skill",
    "tool",
    "architecture",
    "cloud service",
    "audit",
    "compliance",
)

_KB_SEARCH_TERMS = (
    "kb",
    "knowledge base",
    "document",
    "case study",
    "case studies",
    "battlecard",
    "billing",
    "commercial",
    "project",
    "projects",
    "proposal",
    "proposals",
    "payment",
    "payments",
    "pricing",
    "rate card",
    "product",
    "products",
    "playbook",
    "process",
    "processes",
    "service",
    "services",
    "tkxel",
    "techcel",
    "engagement model",
    "engagement models",
    "delivery model",
    "delivery models",
    "delivery approach",
    "onboarding",
    "kickoff",
    "nda",
    "sow",
    "msa",
    "ai-first",
    "ai first",
    "ai governance",
    "governance",
    "industry",
    "security",
    "cybersecurity",
    "compliance",
    "soc2",
    "soc 2",
)

_QUERY_STOPWORDS = {
    "about",
    "back",
    "base",
    "case",
    "come",
    "find",
    "for",
    "from",
    "give",
    "industry",
    "knowledge",
    "list",
    "match",
    "matches",
    "mention",
    "need",
    "product",
    "products",
    "project",
    "projects",
    "proper",
    "read",
    "recommend",
    "search",
    "share",
    "show",
    "source",
    "study",
    "tell",
    "the",
    "what",
    "which",
    "with",
}

_QUERY_TERM_ALIASES = {
    "searcuity": "security",
    "secuirty": "security",
    "secruity": "security",
    "secutity": "security",
    "cyber": "cybersecurity",
    "soc": "soc 2",
    "soc2": "soc 2",
}


def _norm_field_key(value: str) -> str:
    return " ".join(value.replace("_", " ").replace("-", " ").strip().lower().split())


def _clean_field_value(value: Any) -> str:
    text = str(value or "").strip()
    if not text or text.upper() in {"N/A", "NA", "NONE", "NULL", "-"}:
        return ""
    return text


def _field_lookup(fields: Dict[str, Any], keys: Tuple[str, ...]) -> str:
    normalized = {_norm_field_key(k): _clean_field_value(v) for k, v in fields.items()}
    for key in keys:
        value = normalized.get(_norm_field_key(key))
        if value:
            return value
    return ""


def _looks_like_kb_search(message: str) -> bool:
    lower = message.lower()
    return any(term in lower for term in _KB_SEARCH_TERMS)


def _parse_field_line(line: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for part in line.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key = key.strip()
        value = _clean_field_value(value)
        if key and value:
            fields[key] = value
    return fields


def _project_rows_from_text(text: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for line in (text or "").splitlines():
        fields = _parse_field_line(line)
        if fields:
            rows.append(fields)
    if rows:
        return rows
    fields = _parse_field_line(text or "")
    return [fields] if fields else []


def _query_focus_terms(query: str) -> List[str]:
    terms: List[str] = []
    for raw in re.findall(r"[a-zA-Z0-9]+", query.lower()):
        token = _QUERY_TERM_ALIASES.get(raw, raw)
        if token in _QUERY_STOPWORDS or len(token) < 4:
            continue
        if token not in terms:
            terms.append(token)
    return terms[:6]


def _text_matches_focus(text: str, focus_terms: List[str]) -> int:
    haystack = text.lower()
    score = 0
    for term in focus_terms:
        if term == "security":
            if any(t in haystack for t in ("security", "cybersecurity", "cyber security", "soc 2", "soc2")):
                score += 1
            continue
        if term in haystack:
            score += 1
    return score


def _format_project_detail(fields: Dict[str, Any], fallback: str) -> str:
    detail_parts: List[str] = []
    normalized = {_norm_field_key(k): _clean_field_value(v) for k, v in fields.items()}
    for key in _PROJECT_DETAIL_KEYS:
        value = normalized.get(_norm_field_key(key))
        if not value or value.startswith("http"):
            continue
        label = key.title().replace(" / ", "/")
        detail_parts.append(f"{label}: {value}")
        if len(detail_parts) >= 3:
            break
    if detail_parts:
        return "; ".join(detail_parts)

    if fields:
        return "No useful industry, solution, technology, or compliance detail in this KB row."

    snippet = fallback.strip().replace("\n", " ")
    if len(snippet) > 220:
        snippet = f"{snippet[:217]}..."
    return snippet


def _hit_asset_title(hit: Dict[str, Any]) -> str:
    metadata = hit.get("metadata") or {}
    return (
        _clean_field_value(hit.get("title"))
        or _field_lookup(metadata, ("company", "title", "name"))
        or _clean_field_value(metadata.get("asset_id"))
        or _clean_field_value(hit.get("asset_id"))
        or "Knowledge base item"
    )


def _source_name_for_hit(hit: Dict[str, Any]) -> str:
    if hit.get("source_type") == "company_playbook":
        return "Company knowledge base"
    metadata = hit.get("metadata") or {}
    return (
        _clean_field_value(metadata.get("title"))
        or _clean_field_value(hit.get("title"))
        or _clean_field_value(metadata.get("source"))
        or _clean_field_value(hit.get("asset_id"))
        or "Knowledge base"
    )


def _kb_items_from_hits(
    hits: List[Dict[str, Any]],
    *,
    query: str = "",
) -> Tuple[List[Dict[str, Any]], bool]:
    focus_terms = _query_focus_terms(query)
    items: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for hit in hits:
        metadata = hit.get("metadata") or {}
        chunk_text = str(hit.get("chunk_text") or "")
        source = _source_name_for_hit(hit)
        if hit.get("source_type") == "company_playbook":
            title = _hit_asset_title(hit)
            searchable = " ".join([title, source, chunk_text, " ".join(_clean_field_value(v) for v in metadata.values())])
            focus_score = _text_matches_focus(searchable, focus_terms)
            dedupe_key = f"{title.lower()}::{source.lower()}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            items.append(
                {
                    "title": title,
                    "detail": _field_excerpt(chunk_text, 520),
                    "source": source,
                    "asset_id": str(hit.get("asset_id") or ""),
                    "focus_score": focus_score,
                    "retrieval_score": float(hit.get("score") or 0),
                    "is_exact": not focus_terms or focus_score > 0,
                    "source_type": "company_playbook",
                }
            )
            continue

        rows = _project_rows_from_text(chunk_text)
        if not rows:
            rows = [metadata] if metadata else [{}]

        for fields in rows:
            title = _field_lookup(fields, _PROJECT_TITLE_KEYS) or _hit_asset_title(hit)
            detail = _format_project_detail(fields, chunk_text)
            searchable = " ".join(
                [
                    title,
                    source,
                    detail,
                    " ".join(_clean_field_value(v) for v in fields.values()),
                    " ".join(_clean_field_value(v) for v in metadata.values()),
                ]
            )
            focus_score = _text_matches_focus(searchable, focus_terms)
            dedupe_key = f"{title.lower()}::{source.lower()}::{detail.lower()[:120]}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            items.append(
                {
                    "title": title,
                    "detail": detail,
                    "source": source,
                    "asset_id": str(hit.get("asset_id") or ""),
                    "focus_score": focus_score,
                    "retrieval_score": float(hit.get("score") or 0),
                    "is_exact": not focus_terms or focus_score > 0,
                    "source_type": str(hit.get("source_type") or "kb_document"),
                }
            )

    items.sort(
        key=lambda item: (
            1 if item["is_exact"] else 0,
            int(item["focus_score"]),
            float(item["retrieval_score"]),
        ),
        reverse=True,
    )
    if focus_terms:
        exact = [item for item in items if item["is_exact"]]
        if exact:
            return exact[:5], True
        return items[:5], False
    return items[:5], True


def _md_cell(value: Any) -> str:
    text = str(value or "").replace("\n", " ").replace("|", "/").strip()
    return text or "—"


def _looks_like_engagement_model_answer(query: str) -> bool:
    tokens = re.findall(r"[a-zA-Z0-9]+", query.lower())
    has_model_word = any(token.startswith("model") for token in tokens)
    has_engagement_word = any(
        token in {"engagement", "engagements", "engaegment", "engagemnt", "engagment", "engagmnt"}
        or token.startswith("engag")
        or token.startswith("engae")
        for token in tokens
    )
    return has_model_word and has_engagement_word


def _looks_like_team_location_answer(query: str) -> bool:
    tokens = re.findall(r"[a-zA-Z0-9]+", query.lower())
    has_location_word = any(
        token in {"office", "offices", "location", "locations", "located", "base", "based"}
        for token in tokens
    )
    has_where_team_phrase = "where" in tokens and any(token in {"team", "teams"} for token in tokens)
    return has_location_word or has_where_team_phrase


def _is_low_value_playbook_item(item: Dict[str, Any]) -> bool:
    title = str(item.get("title") or "").lower()
    return any(
        section in title
        for section in (
            "source urls",
            "suggested kb tags",
            "internal gaps to add next",
            "company playbook for dc copilot",
            "copilot answer policy",
        )
    )


def _format_engagement_models_playbook_answer() -> str:
    return (
        "I found this in the company playbook:\n\n"
        "**Tkxel engagement models**\n\n"
        "- **Fixed-price/project-based:** best when scope, requirements, timeline, and deliverables are clear, and the client needs cost certainty.\n"
        "- **Dedicated team:** best when the client needs long-term specialists working as an extension of their team with day-to-day priority control.\n"
        "- **Offshore development center:** best when the client needs scalable engineering capacity, specialized skills, and lower fixed overhead.\n"
        "- **Hybrid delivery:** best when the client needs close collaboration or local/near-shore coordination plus offshore execution.\n\n"
        "Boundary: Time and Material appears in the public FAQ, but the playbook says to treat it as available only if internal sales/commercial policy confirms it."
    )


def _format_team_locations_playbook_answer() -> str:
    return (
        "I found this in the company playbook:\n\n"
        "**Tkxel team / office footprint**\n\n"
        "- **USA:** Reston, Virginia.\n"
        "- **Saudi Arabia:** Dammam.\n"
        "- **Portugal:** Lisbon.\n"
        "- **Pakistan:** Lahore.\n\n"
        "The playbook also notes **800+ professionals** and **4 global offices**."
    )


def _format_company_playbook_hits(items: List[Dict[str, Any]], *, query: str, empty: str) -> str:
    answer_items = [item for item in items if not _is_low_value_playbook_item(item)]
    if not answer_items:
        return empty

    if _looks_like_engagement_model_answer(query):
        return _format_engagement_models_playbook_answer()
    if _looks_like_team_location_answer(query):
        return _format_team_locations_playbook_answer()

    lines = ["I found this in the company playbook:", ""]
    for item in answer_items[:1]:
        lines.append(f"**{item['title']}**")
        lines.append("")
        lines.append(_field_excerpt(item["detail"], 700))
        lines.append("")
    return "\n".join(lines).strip()


def _format_kb_hits(hits: List[Dict[str, Any]], *, query: str, empty: str) -> str:
    if not hits:
        return empty

    items, has_exact = _kb_items_from_hits(hits, query=query)
    if not items:
        return empty

    if items and all(item.get("source_type") == "company_playbook" for item in items):
        return _format_company_playbook_hits(items, query=query, empty=empty)

    if has_exact:
        lines = [
            "I found these KB-backed matches. I would use the first one if you need the closest fit:",
            "",
            "| Project / product | Relevant information | KB source |",
            "|---|---|---|",
        ]
    else:
        lines = [
            "I could not find a clean KB-backed match for that exact industry/product ask.",
            "I filtered out the nearest KB hits because they do not match the requested terms:",
            "",
            "| KB source | Why I filtered it out |",
            "|---|---|---|",
        ]

    for item in items:
        if has_exact:
            lines.append(
                f"| {_md_cell(item['title'])} | {_md_cell(item['detail'])} | {_md_cell(item['source'])} |"
            )
        else:
            reason = f"{item['title']}: {item['detail']}"
            lines.append(f"| {_md_cell(item['source'])} | {_md_cell(reason)} |")
    return "\n".join(lines)


class SalesCopilotAgent:
    """RAG + tool-use Sales Co-pilot orchestrating calls, KB, and agents."""

    def __init__(
        self,
        ctx: TenantContext,
        *,
        orchestrator: Optional[Any] = None,
    ) -> None:
        self.ctx = ctx
        self.calls = CallsService()
        self._orch = orchestrator
        self._actions_taken: List[Dict[str, Any]] = []
        self._citations: List[Citation] = []

    def _get_orchestrator(self) -> Any:
        if self._orch is None:
            from app.orchestrator.dispatcher import Orchestrator

            self._orch = Orchestrator()
        return self._orch

    def _load_current_screen_entity(
        self,
        ctx: Dict[str, Any],
        lines: List[str],
    ) -> None:
        """Load the specific entity the user is currently viewing and inject it
        into the context lines so the LLM answers about *this* screen, not the
        generic home dashboard."""

        asset_id: Optional[str] = ctx.get("assetId")
        project_id: Optional[str] = ctx.get("projectId")
        agent_id: Optional[str] = ctx.get("agentId")

        if asset_id:
            try:
                repo = get_kb_repository()
                asset = repo.get_asset(self.ctx, asset_id)
                if asset:
                    asset_summary = _compact_json(
                        {
                            "id": asset.get("id"),
                            "title": asset.get("title"),
                            "type": asset.get("type") or asset.get("asset_type"),
                            "description": asset.get("description"),
                            "tags": asset.get("tags"),
                            "createdAt": asset.get("createdAt") or asset.get("created_at"),
                        },
                        800,
                    )
                    lines.append(f"Currently viewed KB asset: {asset_summary}")
                    # Include a short text preview from chunk storage
                    try:
                        chunks = repo.list_asset_chunk_texts(self.ctx, asset_id, limit=6)
                        if chunks:
                            preview = "\n".join(chunks[:3])[:1200]
                            lines.append(f"Asset content preview:\n{preview}")
                    except Exception:
                        pass
                    self._citations.append(
                        Citation(
                            source_type="kb_asset",
                            source_id=asset_id,
                            snippet=_field_excerpt(asset.get("title") or asset_id),
                            confidence=0.88,
                        )
                    )
            except Exception:
                pass

        if project_id:
            try:
                project = get_content_studio_repository().get_project(self.ctx, project_id)
                if project:
                    project_summary = _compact_json(
                        {
                            "id": project.get("id"),
                            "title": project.get("title"),
                            "artifactType": project.get("artifactType") or project.get("artifact_type"),
                            "status": project.get("status"),
                            "brief": project.get("brief"),
                            "callId": project.get("callId") or project.get("call_id"),
                        },
                        900,
                    )
                    lines.append(f"Currently viewed content project: {project_summary}")
                    self._citations.append(
                        Citation(
                            source_type="content_project",
                            source_id=project_id,
                            snippet=_field_excerpt(project.get("title") or project_id),
                            confidence=0.85,
                        )
                    )
            except Exception:
                pass

        if agent_id:
            # agent_id from the URL slug (e.g. "pre-dc", "workflow") — include
            # it as a hint so the LLM focuses on that specific agent workflow.
            lines.append(f"Currently viewed agent page: {agent_id}")

    def _build_surface_context(
        self,
        message: str,
        *,
        call_id: Optional[str],
        surface: str,
        context: Optional[Dict[str, Any]],
    ) -> Tuple[str, List[str]]:
        clean_surface = surface if surface in SURFACE_GUIDANCE else "global"
        ctx = context or {}
        lines = [
            f"Surface: {clean_surface}",
            f"Surface guidance: {SURFACE_GUIDANCE[clean_surface]}",
        ]
        if ctx:
            lines.append(f"UI context: {_compact_json(ctx, 1200)}")

        # Load the specific entity the user is currently viewing so the copilot
        # can answer questions about it rather than defaulting to generic home context.
        self._load_current_screen_entity(ctx, lines)

        missing: List[str] = []
        call: Optional[Dict[str, Any]] = None
        brief: Optional[Dict[str, Any]] = None
        post_review: Optional[Dict[str, Any]] = None
        events: List[Dict[str, Any]] = []
        use_ui_live_transcript = clean_surface == "live_dc" and "transcriptLineCount" in ctx

        if call_id:
            call = self.calls.get_call(self.ctx, call_id)
            brief = self.calls.get_brief(self.ctx, call_id)
            if clean_surface == "post_dc":
                post_review = self.calls.get_post_review(self.ctx, call_id)
            if not use_ui_live_transcript:
                events = get_live_call_repository().list_transcript_events(self.ctx, call_id, limit=80)

            lines.append(f"Active call: {call_id} / {_call_label(call, call_id)}")
            if call:
                lines.append(
                    "Call facts: "
                    + _compact_json(
                        {
                            "accountName": call.get("accountName"),
                            "leadName": call.get("leadName"),
                            "leadTitle": call.get("leadTitle"),
                            "industry": call.get("industry"),
                            "status": call.get("status"),
                            "dealStage": call.get("dealStage"),
                            "bant": call.get("bant"),
                            "icpBucket": call.get("icpBucket"),
                        },
                        1400,
                    )
                )
                self._citations.append(
                    Citation(
                        source_type="call_record",
                        source_id=call_id,
                        snippet=_field_excerpt(call.get("accountName") or call_id),
                        confidence=0.82,
                    )
                )
            else:
                ui_account = ctx.get("accountName") or ctx.get("account_name")
                if ui_account:
                    lines.append(
                        "Active call from UI context: "
                        + _compact_json(
                            {
                                "accountName": ui_account,
                                "leadName": ctx.get("leadName"),
                                "intentLabel": ctx.get("intentLabel"),
                            },
                            800,
                        )
                    )
                    self._citations.append(
                        Citation(
                            source_type="ui_context",
                            source_id=call_id,
                            snippet=_field_excerpt(ui_account),
                            confidence=0.68,
                        )
                    )
                else:
                    missing.append("active call record")

            if brief:
                brief_excerpt = _compact_json(
                    {
                        "aiSummary": brief.get("aiSummary"),
                        "summarySections": brief.get("summarySections"),
                        "pains": brief.get("pains"),
                        "discoveryQuestions": brief.get("discoveryQuestions"),
                        "clientAttendees": brief.get("clientAttendees"),
                        "relevantContent": brief.get("relevantContent"),
                    },
                    2400,
                )
                lines.append(f"Pre-DC brief: {brief_excerpt}")
                self._citations.append(
                    Citation(
                        source_type="call_brief",
                        source_id=call_id,
                        snippet=_field_excerpt(brief.get("aiSummary") or brief_excerpt),
                        confidence=0.86,
                    )
                )
            elif clean_surface in ("pre_dc", "live_dc", "post_dc"):
                if ctx.get("briefSummary") or ctx.get("briefReady"):
                    lines.append(
                        "Brief summary from UI context: "
                        + _field_excerpt(ctx.get("briefSummary") or "Brief marked ready in UI", 600)
                    )
                    self._citations.append(
                        Citation(
                            source_type="ui_context",
                            source_id=call_id,
                            snippet=_field_excerpt(ctx.get("briefSummary") or "Brief marked ready in UI"),
                            confidence=0.66,
                        )
                    )
                else:
                    missing.append("pre-DC brief")

            if use_ui_live_transcript:
                transcript_tail = ctx.get("transcriptTail")
                if transcript_tail:
                    lines.append(f"Recent transcript from UI context: {_compact_json(transcript_tail, 1600)}")
                    self._citations.append(
                        Citation(
                            source_type="transcript",
                            source_id=call_id,
                            snippet=_field_excerpt(transcript_tail),
                            confidence=0.68,
                        )
                    )
                else:
                    missing.append("live transcript")
            elif events:
                transcript = _transcript_excerpt(events)
                lines.append(f"Recent transcript:\n{transcript}")
                self._citations.append(
                    Citation(
                        source_type="transcript",
                        source_id=call_id,
                        snippet=_field_excerpt(transcript),
                        confidence=0.82,
                    )
                )
            elif clean_surface == "live_dc":
                transcript_tail = ctx.get("transcriptTail")
                if transcript_tail:
                    lines.append(f"Recent transcript from UI context: {_compact_json(transcript_tail, 1600)}")
                    self._citations.append(
                        Citation(
                            source_type="transcript",
                            source_id=call_id,
                            snippet=_field_excerpt(transcript_tail),
                            confidence=0.68,
                        )
                    )
                else:
                    missing.append("live transcript")

            live_signals = ((call or {}).get("metadata") or {}).get("live_signals")
            if live_signals:
                lines.append(f"Live signal snapshot: {_compact_json(live_signals, 1600)}")

            if post_review:
                lines.append(f"Post-DC review: {_compact_json(post_review, 2200)}")
                self._citations.append(
                    Citation(
                        source_type="post_call_review",
                        source_id=call_id,
                        snippet=_field_excerpt(post_review.get("headline") or post_review.get("summary")),
                        confidence=0.84,
                    )
                )
            elif clean_surface == "post_dc":
                missing.append("post-DC review")

        lower_message = message.lower()
        wants_knowledge = (
            clean_surface in ("knowledge", "content")
            or _looks_like_kb_search(message)
            or any(
                term in lower_message
                for term in (
                    "proof",
                    "case study",
                    "asset",
                    "battlecard",
                    "objection",
                    "competitor",
                    "security",
                    "compliance",
                    "reference",
                )
            )
        )
        if wants_knowledge:
            kb_query_parts = [
                message,
                str(ctx.get("accountName") or ""),
                str(ctx.get("industry") or ""),
                _call_label(call, call_id or "") if call_id else "",
                SURFACE_GUIDANCE.get(clean_surface, ""),
            ]
            kb_query = "\n".join(part for part in kb_query_parts if part.strip())
            kb_hits = _kb_search(self.ctx, kb_query, limit=10) if kb_query.strip() else []
            if kb_hits:
                self._citations.extend(_hits_to_citations(kb_hits))
                self._actions_taken.append(
                    {
                        "tool": "search_knowledge_base",
                        "query": message[:120],
                        "hit_count": len(kb_hits),
                        "surface": clean_surface,
                        "auto_context": True,
                    }
                )
                lines.append(f"Relevant KB evidence:\n{_kb_context_lines(kb_hits)}")
            else:
                missing.append("matching knowledge-base evidence")

        return "\n\n".join(lines), list(dict.fromkeys(missing))

    def _surface_suggestions(
        self,
        surface: str,
        *,
        call_id: Optional[str],
        missing_evidence: List[str],
    ) -> List[str]:
        clean_surface = surface if surface in SURFACE_GUIDANCE else "global"
        if clean_surface == "live_dc":
            suggestions = [
                "Next best question",
                "Decision criteria",
                "Most important BANT gap",
            ]
        elif clean_surface == "pre_dc":
            suggestions = [
                "BANT gaps",
                "Opening talk track",
                "Objection prep",
            ]
        elif clean_surface == "post_dc":
            suggestions = [
                "Client email",
                "Open risks",
                "Jira handoff",
            ]
        elif clean_surface == "knowledge":
            suggestions = [
                "Best case study",
                "Compare assets",
                "Use this asset",
            ]
        else:
            suggestions = [
                "Today's priorities",
                "Missing briefs",
                "Upcoming prep",
            ]
        if call_id and clean_surface != "live_dc":
            suggestions.append("Call summary")
        return suggestions[:4]

    def _surface_cost(self, model: str = "surface-contract") -> Dict[str, Any]:
        return {"tokens": 0, "usd": 0.0, "model": model, "trace_id": str(uuid.uuid4())}

    def _run_surface_contract_path(
        self,
        message: str,
        *,
        surface: str,
        call_id: Optional[str],
        context: Optional[Dict[str, Any]],
    ) -> Optional[Tuple[str, Dict[str, Any]]]:
        clean_surface = surface if surface in COPILOT_SURFACE_CONTRACTS else ""
        if not clean_surface:
            return None

        lower = message.lower()
        if _looks_like_kb_search(message):
            return None

        if clean_surface == "home":
            if any(
                cue in lower
                for cue in (
                    "today",
                    "priority",
                    "priorities",
                    "attention",
                    "missing brief",
                    "missing briefs",
                    "upcoming",
                    "home",
                )
            ):
                return self._home_contract_answer(message), self._surface_cost("surface-home")
            return None

        if clean_surface == "pre_dc" and call_id:
            if any(
                cue in lower
                for cue in (
                    "bant",
                    "gap",
                    "opening",
                    "talk track",
                    "objection",
                    "prep",
                    "summary",
                    "question",
                )
            ):
                return self._pre_dc_contract_answer(message, call_id, context or {}), self._surface_cost("surface-pre-dc")
            return None

        if clean_surface == "post_dc" and call_id:
            if any(
                cue in lower
                for cue in (
                    "follow",
                    "email",
                    "risk",
                    "open",
                    "jira",
                    "handoff",
                    "summary",
                    "next step",
                    "recap",
                )
            ):
                return self._post_dc_contract_answer(message, call_id, context or {}), self._surface_cost("surface-post-dc")
            return None

        return None

    def _home_contract_answer(self, message: str) -> str:
        calls = self.calls.list_calls(self.ctx)
        upcoming = [c for c in calls if str(c.get("status") or "").lower() == "upcoming"]
        live = [c for c in calls if str(c.get("status") or "").lower() == "live"]
        completed = [c for c in calls if str(c.get("status") or "").lower() == "completed"]
        missing = [c for c in calls if not bool(c.get("briefReady"))]
        self._actions_taken.append(
            {
                "tool": "surface_contract",
                "surface": "home",
                "call_count": len(calls),
                "missing_briefs": len(missing),
            }
        )

        if not calls:
            return (
                "**Snapshot**\n\n"
                "- No calls are loaded in this workspace yet.\n\n"
                "**Needs attention**\n\n"
                "- Import or create calls before Copilot can prioritize the day.\n\n"
                "**Next**\n\n"
                "- Add Pre-DC data or sync calls, then ask for today's priorities again."
            )

        priority_calls = (missing[:3] or upcoming[:3] or live[:3] or completed[:3])
        priority_lines = []
        for call in priority_calls:
            reason = "brief missing" if call in missing else f"{call.get('status', 'call')} call"
            priority_lines.append(
                f"- **{call.get('accountName') or call.get('id')}** — {reason}; {_call_schedule(call)}."
            )

        next_line = (
            "Open the first missing brief and run Pre-DC prep."
            if missing
            else "Review the next upcoming call and confirm the BANT gaps."
            if upcoming
            else "Review completed calls for next-step and handoff gaps."
        )

        return (
            "**Snapshot**\n\n"
            f"- Total calls: **{len(calls)}**\n"
            f"- Upcoming: **{len(upcoming)}**\n"
            f"- Live: **{len(live)}**\n"
            f"- Completed: **{len(completed)}**\n"
            f"- Briefs missing: **{len(missing)}**\n\n"
            "**Needs attention**\n\n"
            + "\n".join(priority_lines)
            + "\n\n"
            "**Next**\n\n"
            f"- {next_line}"
        )

    def _pre_dc_contract_answer(self, message: str, call_id: str, context: Dict[str, Any]) -> str:
        call = self.calls.get_call(self.ctx, call_id)
        brief = self.calls.get_brief(self.ctx, call_id) or {}
        lower = message.lower()
        self._actions_taken.append(
            {
                "tool": "surface_contract",
                "surface": "pre_dc",
                "call_id": call_id,
                "brief_available": bool(brief),
            }
        )

        if not call:
            account_from_context = _field_excerpt(context.get("accountName") or context.get("account_name"), 120)
            if account_from_context:
                open_gaps = context.get("openGaps") if isinstance(context.get("openGaps"), list) else []
                gap_text = ", ".join(str(gap).title() for gap in open_gaps[:4]) or "budget, authority, need, timeline"
                return (
                    "**Prep snapshot**\n\n"
                    f"- Account: **{account_from_context}**\n"
                    "- Backend call data is not loaded for this screen id, so I am using current screen context only.\n\n"
                    "**Gaps to close**\n\n"
                    f"- Prioritize: {gap_text}.\n\n"
                    "**Recommended talk track**\n\n"
                    "- Confirm the business problem, decision owner, budget range, and target timeline before moving into solution detail."
                )
            return (
                "**Prep snapshot**\n\n"
                f"- I could not find call data for `{call_id}`.\n\n"
                "**Gaps to close**\n\n"
                "- Load the call record before using Pre-DC Copilot.\n\n"
                "**Recommended talk track**\n\n"
                "- Not available until the active call record is loaded."
            )

        account = call.get("accountName") or call_id
        bant_gaps = _bant_gap_labels(call.get("bant"))
        pains = _bullet_lines(brief.get("pains") or [], key="text", limit=3)
        objections = brief.get("objections") or []
        questions = _bullet_lines(brief.get("discoveryQuestions") or [], limit=3)

        if "opening" in lower or "talk track" in lower:
            pain = _field_excerpt((brief.get("pains") or [{}])[0].get("text") if brief.get("pains") else None)
            talk_track = (
                f"Thanks for making time. I want to use this call to understand what is driving the {account} initiative, "
                f"where the decision process stands, and whether we can help with {pain or 'the highest-priority workflow'}."
            )
            return (
                "**Prep snapshot**\n\n"
                f"- Account: **{account}**\n"
                f"- Lead: **{_field_excerpt(call.get('leadName') or call.get('leadTitle')) or 'not captured'}**\n"
                f"- Known value: **{_money_or_dash(call.get('annualRevenue') or call.get('annualRevenueRaw'))}**\n\n"
                "**Gaps to close**\n\n"
                + "\n".join(f"- {gap.title()}" for gap in bant_gaps[:4])
                + "\n\n"
                "**Recommended talk track**\n\n"
                f"- {talk_track}"
            )

        if "objection" in lower:
            objection_lines = []
            for obj in objections[:3]:
                objection = _field_excerpt(obj.get("objection") if isinstance(obj, dict) else obj)
                handler = _field_excerpt(obj.get("handler") if isinstance(obj, dict) else None)
                if objection:
                    objection_lines.append(f"- **{objection}** — {handler or 'ask a clarifying question before positioning.'}")
            if not objection_lines:
                objection_lines = ["- No specific objections are captured in the pre-call brief yet."]
            return (
                "**Prep snapshot**\n\n"
                f"- Account: **{account}**\n"
                f"- Brief available: **{'yes' if brief else 'no'}**\n\n"
                "**Gaps to close**\n\n"
                + "\n".join(f"- {gap.title()}" for gap in bant_gaps[:4])
                + "\n\n"
                "**Recommended talk track**\n\n"
                + "\n".join(objection_lines)
            )

        gap_lines = [f"- **{gap.title()}** — confirm before proposal or next-step framing." for gap in bant_gaps]
        if not gap_lines:
            gap_lines = ["- BANT appears confirmed in the call record."]
        if questions:
            next_questions = "\n".join(questions)
        else:
            next_questions = "- Ask what success would need to look like for this project to move forward."

        return (
            "**Prep snapshot**\n\n"
            f"- Account: **{account}**\n"
            f"- Stage: **{_field_excerpt(call.get('dealStage')) or 'not captured'}**\n"
            f"- Brief summary: {_field_excerpt(brief.get('aiSummary'), 260) or 'brief summary not available'}\n\n"
            "**Gaps to close**\n\n"
            + "\n".join(gap_lines[:4])
            + "\n\n"
            "**Recommended talk track**\n\n"
            + (next_questions if not pains else "\n".join(pains[:2] + questions[:2]))
        )

    def _post_dc_contract_answer(self, message: str, call_id: str, context: Dict[str, Any]) -> str:
        call = self.calls.get_call(self.ctx, call_id)
        review_payload = self.calls.get_post_review(self.ctx, call_id) or {}
        review = review_payload.get("review") if isinstance(review_payload.get("review"), dict) else review_payload
        lower = message.lower()
        self._actions_taken.append(
            {
                "tool": "surface_contract",
                "surface": "post_dc",
                "call_id": call_id,
                "review_available": bool(review),
            }
        )

        account = (call or {}).get("accountName") or call_id
        if not review:
            headline_from_context = _field_excerpt(context.get("reviewHeadline"), 220)
            next_from_context = _field_excerpt(context.get("nextStepProposal"), 260)
            if headline_from_context or next_from_context:
                return (
                    "**Outcome**\n\n"
                    f"- Account: **{account}**\n"
                    f"- {headline_from_context or 'Post-call review is available on the current screen.'}\n\n"
                    "**Open risks**\n\n"
                    "- Use the visible review cards to confirm any unresolved BANT or delivery risks.\n\n"
                    "**Next-step path**\n\n"
                    f"- {next_from_context or 'Confirm the owner, date, and decision criteria for the next step.'}"
                )
            return (
                "**Outcome**\n\n"
                f"- I do not have a post-call review for **{account}** yet.\n\n"
                "**Open risks**\n\n"
                "- Run or refresh the Post-DC pipeline before relying on next-step guidance.\n\n"
                "**Next-step path**\n\n"
                "- Once the review is available, I can draft the client email, risks, and Jira handoff."
            )

        headline = _field_excerpt(review.get("headline"), 220)
        summary_lines = _bullet_lines(review.get("summary") or [], limit=3)
        gaps = review.get("openDiscoveryGaps") or []
        next_step = _field_excerpt(review.get("nextStepProposal"), 260)

        if "jira" in lower or "handoff" in lower:
            follow = [
                f"- Scope/context: {headline or 'use the post-call summary as the handoff context.'}",
                f"- Open discovery gaps: {', '.join(gaps) if gaps else 'none captured.'}",
                f"- Next step: {next_step or 'not captured in the review.'}",
            ]
        elif "email" in lower or "follow" in lower:
            follow = [
                f"- Thank them for the discussion with **{account}**.",
                f"- Recap: {headline or (summary_lines[0].removeprefix('- ') if summary_lines else 'use the confirmed call outcome.')}",
                f"- Ask for: {next_step or 'confirmation of the next step and owner.'}",
            ]
        else:
            follow = [f"- {next_step or 'Confirm owner, date, and decision criteria for the next step.'}"]

        risk_lines = [f"- {gap}" for gap in gaps[:4]] or ["- No open discovery gaps are captured in the review."]

        return (
            "**Outcome**\n\n"
            f"- Account: **{account}**\n"
            f"- {headline or 'Post-call headline is not captured.'}\n"
            + ("\n".join(summary_lines[:2]) if summary_lines else "")
            + "\n\n"
            "**Open risks**\n\n"
            + "\n".join(risk_lines)
            + "\n\n"
            "**Next-step path**\n\n"
            + "\n".join(follow)
        )

    def run(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        *,
        call_id: Optional[str] = None,
        surface: str = "global",
        context: Optional[Dict[str, Any]] = None,
    ) -> AgentEnvelope:
        history = history or []
        settings = get_settings()
        trace_id = str(uuid.uuid4())

        surface_context, missing_evidence = self._build_surface_context(
            message,
            call_id=call_id,
            surface=surface,
            context=context,
        )
        context_note = f"\n\nContext pack:\n{surface_context}"

        # Fast-path common operational prompts so the UI responds quickly.
        fast = self._run_surface_contract_path(
            message,
            surface=surface,
            call_id=call_id,
            context=context,
        )
        if fast is None:
            fast = self._run_fast_path(message, call_id=call_id, surface=surface)
        if fast is not None:
            answer, cost = fast
        else:
            use_llm = settings.openai_configured
            if use_llm:
                try:
                    import openai  # noqa: F401
                except ModuleNotFoundError:
                    use_llm = False

            if use_llm:
                answer, cost = self._run_llm_tools(
                    message,
                    history,
                    context_note=context_note,
                    call_id=call_id,
                )
            else:
                answer, cost = self._run_fallback(message, call_id=call_id)

        answer = _polish_copilot_answer(answer, surface=surface)

        if not self._citations:
            self._citations.append(
                Citation(
                    source_type="system",
                    source_id="sales-copilot",
                    snippet=(answer or "")[:200],
                    confidence=0.6,
                )
            )
        self._citations = _dedupe_citations(self._citations)

        env = AgentEnvelope(
            agent="sales-copilot",
            operation="copilot_chat",
            result={
                "answer": answer,
                "actions_taken": self._actions_taken,
                "call_exports": [
                    a.get("export")
                    for a in self._actions_taken
                    if a.get("export")
                ],
                "suggestions": self._surface_suggestions(
                    surface,
                    call_id=call_id,
                    missing_evidence=missing_evidence,
                ),
                "missing_evidence": missing_evidence,
                "surface": surface,
            },
            citations=self._citations,
            confidence=0.88 if self._actions_taken else 0.75,
            cost=cost,
            trace_id=cost.get("trace_id", trace_id),
        )
        validate_envelope(env)
        return env

    def _run_fast_path(
        self,
        message: str,
        *,
        call_id: Optional[str] = None,
        surface: str = "global",
    ) -> Optional[Tuple[str, Dict[str, Any]]]:
        lower = message.lower()
        trace_id = str(uuid.uuid4())

        if (
            surface in ("home", "global")
            and ("summaris" in lower or "summary" in lower or "list" in lower)
            and "call" in lower
            and "this call" not in lower
        ):
            calls = self.calls.list_calls(self.ctx)
            ready = [c for c in calls if bool(c.get("briefReady"))]
            missing = [c for c in calls if not bool(c.get("briefReady"))]
            self._actions_taken.append({"tool": "list_calls", "count": len(calls), "fast_path": True})
            lines = [
                f"Calls found: **{len(calls)}**",
                f"Brief ready: **{len(ready)}**",
                f"Brief missing: **{len(missing)}**",
                "",
                "Top calls:",
            ]
            for c in calls[:10]:
                lines.append(f"- {c.get('accountName')} ({c.get('id')}) — {c.get('status')}")
            if missing:
                lines.append("")
                lines.append("Needs brief:")
                for c in missing[:10]:
                    lines.append(f"- {c.get('accountName')} ({c.get('id')})")
            return "\n".join(lines), {
                "tokens": len(message) // 4,
                "usd": 0.0,
                "model": "fast-path-list-calls",
                "trace_id": trace_id,
            }

        if _looks_like_kb_search(message):
            hits = _kb_search(self.ctx, message, limit=20)
            self._citations.extend(_hits_to_citations(hits))
            self._actions_taken.append(
                {"tool": "search_knowledge_base", "query": message[:120], "hit_count": len(hits), "fast_path": True}
            )
            return _format_kb_hits(
                hits,
                query=message,
                empty="No matching knowledge base or project entries found.",
            ), {
                "tokens": len(message) // 4,
                "usd": 0.0,
                "model": "fast-path-kb",
                "trace_id": trace_id,
            }

        if call_id and any(w in lower for w in ("export", "download")):
            export = self._build_export(call_id, "markdown" if "markdown" in lower else "json")
            self._actions_taken.append(
                {"tool": "export_call_summary", "call_id": call_id, "format": "markdown" if "markdown" in lower else "json", "export": export, "fast_path": True}
            )
            return "Prepared call summary export.", {
                "tokens": len(message) // 4,
                "usd": 0.0,
                "model": "fast-path-export",
                "trace_id": trace_id,
            }

        return None

    def _execute_tool(self, name: str, tool_input: Dict[str, Any]) -> str:
        try:
            if name == "search_knowledge_base":
                query = str(tool_input.get("query") or "")
                limit = int(tool_input.get("limit") or 5)
                hits = _kb_search(self.ctx, query, limit=max(limit * 4, 20))
                items, has_exact = _kb_items_from_hits(hits, query=query)
                self._citations.extend(_hits_to_citations(hits))
                self._actions_taken.append(
                    {
                        "tool": name,
                        "query": query,
                        "hit_count": len(hits),
                        "result_count": len(items),
                        "exact_match": has_exact,
                    }
                )
                return json.dumps(
                    {
                        "query": query,
                        "exact_match": has_exact,
                        "results": [
                            {
                                "project_or_product": item["title"],
                                "relevant_information": item["detail"],
                                "kb_source": item["source"],
                                "asset_id": item["asset_id"],
                            }
                            for item in items[:limit]
                        ],
                    },
                    default=str,
                )

            if name == "list_calls":
                status = (tool_input.get("status") or "").strip().lower()
                limit = int(tool_input.get("limit") or 20)
                calls = self.calls.list_calls(self.ctx)
                if status:
                    calls = [c for c in calls if (c.get("status") or "").lower() == status]
                calls = calls[:limit]
                self._actions_taken.append({"tool": name, "count": len(calls)})
                return json.dumps(calls, default=str)

            if name == "get_call_details":
                cid = str(tool_input.get("call_id") or "")
                call = self.calls.get_call(self.ctx, cid)
                brief = self.calls.get_brief(self.ctx, cid)
                payload = {"call": call, "brief": brief}
                if call:
                    meta = call.get("metadata") or {}
                    if meta.get("live_signals"):
                        payload["live_signals"] = meta["live_signals"]
                self._actions_taken.append({"tool": name, "call_id": cid})
                return json.dumps(payload, default=str)[:12000]

            if name == "get_call_transcript":
                cid = str(tool_input.get("call_id") or "")
                last_n = int(tool_input.get("last_n") or 40)
                events = get_live_call_repository().list_transcript_events(
                    self.ctx, cid, limit=last_n
                )
                self._actions_taken.append(
                    {"tool": name, "call_id": cid, "segments": len(events)}
                )
                if events:
                    self._citations.append(
                        Citation(
                            source_type="transcript",
                            source_id=cid,
                            snippet=(events[-1].get("text") or "")[:200],
                            confidence=0.75,
                        )
                    )
                return json.dumps(events, default=str)[:10000]

            if name == "dispatch_agent":
                agent_name = str(tool_input.get("agent_name") or "").strip().lower()
                cid = str(tool_input.get("call_id") or "")
                params = tool_input.get("params") or {}
                result = self._dispatch_named_agent(agent_name, cid, params)
                self._actions_taken.append(
                    {
                        "tool": name,
                        "agent": agent_name,
                        "call_id": cid,
                        "status": result.get("status", "ok"),
                        "summary": result.get("summary"),
                    }
                )
                return json.dumps(result, default=str)[:8000]

            if name == "export_call_summary":
                cid = str(tool_input.get("call_id") or "")
                fmt = (tool_input.get("format") or "json").strip().lower()
                export = self._build_export(cid, fmt)
                self._actions_taken.append(
                    {
                        "tool": name,
                        "call_id": cid,
                        "format": fmt,
                        "export": export,
                    }
                )
                return json.dumps(export, default=str)[:12000]

            return json.dumps({"error": f"Unknown tool: {name}"})
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def _dispatch_named_agent(
        self, agent_name: str, call_id: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        orch = self._get_orchestrator()
        name = agent_name.replace("-", "_")

        if name in ("pre_dc_brief", "generate_brief", "brief"):
            env = orch.dispatch_pre_dc_brief(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Pre-DC brief generated", "envelope": env}

        if name in ("pre_dc_pipeline", "workflow", "pipeline"):
            fields = orch._pre_dc_fields_for_call(self.ctx, call_id)  # noqa: SLF001
            if not fields:
                return {"status": "error", "message": "No Pre-DC DC notes fields for this call"}
            env = orch.dispatch_pre_dc_pipeline(self.ctx, call_id, fields, trigger="manual")
            return {"status": "ok", "agent": agent_name, "summary": "Pre-DC pipeline completed", "envelope": env}

        if name in ("relevant_content", "relevant"):
            data = orch.dispatch_relevant_content(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Relevant content loaded", "result": data}

        if name in ("post_call", "postcall"):
            data = orch.dispatch_post_call(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Post-call pipeline completed", "result": data}

        if name in ("call_end", "end_live", "end"):
            data = orch.dispatch_call_end(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Call ended", "result": data}

        if name in ("kb_ingest", "knowledge"):
            asset = params.get("asset") or params
            env = orch.dispatch_kb_ingest(self.ctx, asset)
            return {"status": "ok", "agent": agent_name, "summary": "KB metadata ingested", "envelope": env}

        return {
            "status": "error",
            "message": f"Unknown agent_name: {agent_name}. Use one of: {[a['id'] for a in DISPATCHABLE_AGENTS]}",
        }

    def _build_export(self, call_id: str, fmt: str) -> Dict[str, Any]:
        call = self.calls.get_call(self.ctx, call_id)
        brief = self.calls.get_brief(self.ctx, call_id) or {}
        events = get_live_call_repository().list_transcript_events(self.ctx, call_id, limit=200)
        payload = {
            "call_id": call_id,
            "call": call,
            "brief": brief,
            "transcript": events,
        }
        if fmt == "markdown":
            lines = [
                f"# Call summary: {call_id}",
                "",
                f"**Account:** {(call or {}).get('accountName', '—')}",
                f"**Status:** {(call or {}).get('status', '—')}",
                "",
                "## Brief",
                (brief.get("aiSummary") or "_No summary_"),
                "",
                "## Transcript",
            ]
            for ev in events[-50:]:
                speaker = ev.get("speaker_role") or ev.get("speaker_id") or "?"
                lines.append(f"- **{speaker}:** {ev.get('text', '')}")
            payload["markdown"] = "\n".join(lines)
        return payload

    def _run_llm_tools(
        self,
        message: str,
        history: List[Dict[str, str]],
        *,
        context_note: str = "",
        call_id: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        from openai import OpenAI

        settings = get_settings()
        client = OpenAI(api_key=settings.openai_api_key, timeout=120.0)
        model = DEFAULT_CHAT_MODEL
        fallback_model = DEFAULT_CHAT_FALLBACK_MODEL
        openai_tools = anthropic_tools_to_openai(TOOL_DEFINITIONS)

        messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in history[-20:]:
            role = turn.get("role")
            content = turn.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": str(content)})

        user_content = message
        if context_note:
            user_content = f"{message}{context_note}"
        messages.append({"role": "user", "content": user_content})

        tokens_in = 0
        tokens_out = 0
        trace_id = str(uuid.uuid4())

        active_model = model
        for _ in range(MAX_TOOL_ITERATIONS):
            try:
                response = client.chat.completions.create(
                    model=active_model,
                    messages=messages,
                    tools=openai_tools,
                    **openai_completion_token_kwargs(active_model, 4096),
                )
            except Exception:
                if active_model != fallback_model:
                    active_model = fallback_model
                    continue
                return self._run_fallback(message, call_id=call_id)

            usage = getattr(response, "usage", None)
            if usage:
                tokens_in += getattr(usage, "prompt_tokens", 0) or 0
                tokens_out += getattr(usage, "completion_tokens", 0) or 0

            choice = response.choices[0]
            assistant_message = choice.message
            finish_reason = choice.finish_reason

            if finish_reason == "stop" and not assistant_message.tool_calls:
                answer = (assistant_message.content or "").strip() or "Done."
                return answer, {
                    "tokens": tokens_in + tokens_out,
                    "usd": 0.0,
                    "model": active_model,
                    "trace_id": trace_id,
                }

            tool_calls = assistant_message.tool_calls or []
            if not tool_calls:
                if assistant_message.content:
                    return assistant_message.content.strip(), {
                        "tokens": tokens_in + tokens_out,
                        "usd": 0.0,
                        "model": active_model,
                        "trace_id": trace_id,
                    }
                break

            messages.append(
                {
                    "role": "assistant",
                    "content": assistant_message.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )

            for tool_call in tool_calls:
                raw_args = tool_call.function.arguments or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except json.JSONDecodeError:
                    args = {}
                if not isinstance(args, dict):
                    args = {}
                result_str = self._execute_tool(tool_call.function.name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_str[:14000],
                    }
                )

        llm = LlmClient(openai_api_key=settings.openai_api_key or None)
        completion = llm.complete(
            SYSTEM_PROMPT,
            f"{message}{context_note}\n\nActions so far: {json.dumps(self._actions_taken, default=str)[:2000]}",
            model=active_model,
            fallback_model=fallback_model,
        )
        return completion.text, {
            "tokens": completion.tokens_in + completion.tokens_out,
            "usd": completion.cost_usd,
            "model": completion.model,
            "trace_id": completion.trace_id,
        }

    def _run_fallback(
        self,
        message: str,
        *,
        call_id: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        trace_id = str(uuid.uuid4())
        lower = message.lower()

        if _looks_like_kb_search(message):
            hits = _kb_search(self.ctx, message, limit=20)
            self._citations.extend(_hits_to_citations(hits))
            self._actions_taken.append({"tool": "search_knowledge_base", "hit_count": len(hits)})
            answer = _format_kb_hits(
                hits,
                query=message,
                empty="No matching knowledge base or project entries found.",
            )
        elif any(w in lower for w in ("list call", "calls", "upcoming", "completed")):
            calls = self.calls.list_calls(self.ctx)[:15]
            self._actions_taken.append({"tool": "list_calls", "count": len(calls)})
            lines = [f"- {c.get('accountName')} ({c.get('id')}) — {c.get('status')}" for c in calls]
            answer = "Calls:\n" + ("\n".join(lines) if lines else "_No calls found_")
        elif call_id and any(w in lower for w in ("brief", "detail", "summary")):
            self._execute_tool("get_call_details", {"call_id": call_id})
            brief = self.calls.get_brief(self.ctx, call_id) or {}
            answer = brief.get("aiSummary") or f"Loaded details for call {call_id} (offline mode)."
        elif call_id and "transcript" in lower:
            self._execute_tool("get_call_transcript", {"call_id": call_id, "last_n": 30})
            answer = f"Loaded transcript segments for {call_id} (offline mode)."
        elif call_id and any(w in lower for w in ("export", "download")):
            export = self._build_export(call_id, "markdown" if "markdown" in lower else "json")
            self._actions_taken.append(
                {"tool": "export_call_summary", "call_id": call_id, "export": export}
            )
            answer = export.get("markdown") or json.dumps(export, indent=2)[:2000]
        else:
            hits = _kb_search(self.ctx, message, limit=20)
            self._citations.extend(_hits_to_citations(hits))
            if hits:
                self._actions_taken.append({"tool": "search_knowledge_base", "hit_count": len(hits)})
                answer = _format_kb_hits(
                    hits,
                    query=message,
                    empty="No matching knowledge base or project entries found.",
                )
            else:
                answer = (
                    "Sales Co-pilot (offline): I can search KB, list calls, load briefs/transcripts, "
                    "and run agents when OpenAI is configured. "
                    f"Your question: {message[:200]}"
                )

        return answer, {
            "tokens": len(message) // 4,
            "usd": 0.0,
            "model": "fallback-local",
            "trace_id": trace_id,
        }


def copilot_chat_response(
    ctx: TenantContext,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    *,
    call_id: Optional[str] = None,
    surface: str = "global",
    context: Optional[Dict[str, Any]] = None,
    orchestrator: Optional[Any] = None,
) -> AgentEnvelope:
    agent = SalesCopilotAgent(ctx, orchestrator=orchestrator)
    return agent.run(message, history, call_id=call_id, surface=surface, context=context)
