from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_PLAYBOOK_RELATIVE_PATH = Path("docs/company-playbooks/tkxel-company-playbook.md")
PLAYBOOK_ASSET_ID = "repo-tkxel-company-playbook"
PLAYBOOK_SOURCE_NAME = "Company knowledge base"

_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_STOPWORDS = {
    "about",
    "also",
    "and",
    "are",
    "can",
    "company",
    "does",
    "for",
    "from",
    "how",
    "into",
    "need",
    "our",
    "please",
    "process",
    "standard",
    "standards",
    "tell",
    "that",
    "the",
    "these",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "you",
}
_ALIASES = {
    "engaegment": "engagement",
    "engagemnt": "engagement",
    "engagment": "engagement",
    "engagmnt": "engagement",
    "techcel": "tkxel",
    "tkxcel": "tkxel",
    "txkel": "tkxel",
    "engagements": "engagement",
    "base": "location",
    "based": "location",
    "located": "location",
    "locations": "location",
    "models": "model",
    "offices": "office",
    "payments": "payment",
    "proposals": "proposal",
    "services": "service",
    "teams": "team",
}

_NON_ANSWER_SECTION_TITLES = {
    "tkxel company playbook for dc copilot",
    "copilot answer policy",
    "suggested kb tags",
    "internal gaps to add next",
    "source urls",
}


@dataclass(frozen=True)
class CompanyPlaybookChunk:
    title: str
    text: str
    source_path: str


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / DEFAULT_PLAYBOOK_RELATIVE_PATH
        if candidate.exists():
            return parent
    return current.parents[4]


def company_playbook_path() -> Path:
    override = os.environ.get("COMPANY_PLAYBOOK_PATH", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return _repo_root() / DEFAULT_PLAYBOOK_RELATIVE_PATH


def _plain_text(markdown: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", markdown)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"^\s*[-*]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _chunk_markdown(markdown: str, source_path: Path) -> List[CompanyPlaybookChunk]:
    chunks: List[CompanyPlaybookChunk] = []
    title_stack: List[str] = []
    current_title = ""
    current_lines: List[str] = []

    def flush() -> None:
        nonlocal current_title, current_lines
        body = _plain_text("\n".join(current_lines))
        if current_title and body:
            chunks.append(
                CompanyPlaybookChunk(
                    title=current_title,
                    text=body,
                    source_path=str(source_path),
                )
            )
        current_lines = []

    for raw_line in markdown.splitlines():
        match = _HEADING_RE.match(raw_line.strip())
        if match:
            level = len(match.group(1))
            heading = match.group(2).strip()
            if level <= 3:
                flush()
                title_stack = title_stack[: max(level - 1, 0)]
                title_stack.append(heading)
                display_stack = title_stack
                if len(display_stack) > 1 and display_stack[0].lower().startswith("tkxel company playbook"):
                    display_stack = display_stack[1:]
                current_title = " / ".join(display_stack)
            else:
                current_lines.append(raw_line)
            continue
        current_lines.append(raw_line)

    flush()
    return chunks


@lru_cache(maxsize=4)
def load_company_playbook(path: str | None = None) -> List[CompanyPlaybookChunk]:
    resolved = Path(path).expanduser().resolve() if path else company_playbook_path()
    if not resolved.exists():
        return []
    return _chunk_markdown(resolved.read_text(encoding="utf-8"), resolved)


def _query_terms(query: str) -> List[str]:
    terms: List[str] = []
    for raw in _TOKEN_RE.findall(query.lower()):
        token = _ALIASES.get(raw, raw)
        if len(token) > 5 and token.endswith("s"):
            token = token[:-1]
        if token in _STOPWORDS or len(token) < 3:
            continue
        if token not in terms:
            terms.append(token)
    return terms


def _is_answer_candidate(chunk: CompanyPlaybookChunk) -> bool:
    return chunk.title.strip().lower() not in _NON_ANSWER_SECTION_TITLES


def _is_engagement_model_query(q: str, terms: List[str]) -> bool:
    return "engagement model" in q or ("engagement" in terms and "model" in terms)


def _is_location_query(q: str, terms: List[str]) -> bool:
    return (
        "office" in terms
        or "location" in terms
        or "where" in q and "team" in terms
    )


def _score_chunk(chunk: CompanyPlaybookChunk, query: str, terms: List[str]) -> float:
    title = chunk.title.lower()
    text = chunk.text.lower()
    q = " ".join(_TOKEN_RE.findall(query.lower()))
    score = 0.0

    if q and q in text:
        score += 8.0

    phrase_boosts = (
        ("engagement model", 8.0),
        ("payment term", 8.0),
        ("billing", 6.0),
        ("proposal", 6.0),
        ("onboarding", 6.0),
        ("ai governance", 8.0),
        ("ai first", 6.0),
        ("service catalog", 5.0),
        ("delivery approach", 6.0),
        ("talk track", 5.0),
        ("industry", 4.0),
    )
    for phrase, boost in phrase_boosts:
        if phrase in q and (phrase in title or phrase in text):
            score += boost

    for term in terms:
        if term in title:
            score += 4.0
        if term in text:
            score += min(text.count(term), 5) * 1.2

    if _is_engagement_model_query(q, terms):
        standard_models = (
            "fixed-price",
            "fixed price",
            "project-based",
            "project based",
            "dedicated team",
            "offshore development",
            "hybrid delivery",
        )
        model_mentions = sum(1 for model in standard_models if model in text)
        score += min(model_mentions, 4) * 2.5
        if "standard engagement models" in title or "standard engagement models" in text:
            score += 8.0
        if "time and material" in title and "time" not in terms and "material" not in terms:
            score -= 8.0

    if _is_location_query(q, terms):
        location_markers = (
            "office footprint",
            "global offices",
            "4 global offices",
            "reston",
            "virginia",
            "dammam",
            "saudi arabia",
            "lisbon",
            "portugal",
            "lahore",
            "pakistan",
        )
        marker_hits = sum(1 for marker in location_markers if marker in text)
        score += min(marker_hits, 6) * 3.0
        if "company snapshot" in title or "public proof points" in title:
            score += 5.0
        if "project-based" in text or "project based" in text:
            score -= 3.0
        if "ai-first" in title:
            score -= 4.0

    return score


def search_company_playbook(query: str, *, limit: int = 5) -> List[Dict[str, Any]]:
    query = (query or "").strip()
    if not query:
        return []

    chunks = load_company_playbook()
    terms = _query_terms(query)
    if not terms:
        return []

    scored: List[tuple[float, CompanyPlaybookChunk]] = []
    for chunk in chunks:
        if not _is_answer_candidate(chunk):
            continue
        score = _score_chunk(chunk, query, terms)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    hits: List[Dict[str, Any]] = []
    for score, chunk in scored[: max(limit, 1)]:
        hits.append(
            {
                "tenant_id": "__repo__",
                "asset_id": PLAYBOOK_ASSET_ID,
                "title": f"Tkxel Company Playbook: {chunk.title}",
                "chunk_text": chunk.text,
                "metadata": {
                    "title": PLAYBOOK_SOURCE_NAME,
                    "section": chunk.title,
                    "source_path": chunk.source_path,
                    "source": "repo_company_playbook",
                },
                "score": score,
                "source_type": "company_playbook",
            }
        )
    return hits
