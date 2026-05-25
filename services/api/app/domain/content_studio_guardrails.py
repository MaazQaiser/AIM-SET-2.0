from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional, Set, Tuple

MAX_USER_MESSAGE_CHARS = 8000
MAX_TOKENS_OUT = 4096
PROJECT_COST_CEILING_USD = 1.50

ALLOWED_TAGS = {
    "html",
    "head",
    "meta",
    "body",
    "style",
    "section",
    "article",
    "figure",
    "figcaption",
    "div",
    "span",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "img",
    "strong",
    "em",
    "br",
    "header",
    "footer",
    "main",
    "aside",
}

ALLOWED_ATTRS = {
    "class",
    "id",
    "data-slide",
    "data-role",
    "data-asset-id",
    "data-source",
    "style",
    "template_id",
    "slide",
    "alt",
    "src",
    "charset",
    "name",
    "content",
}

SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),
    re.compile(r"sk-ant-[a-zA-Z0-9\-]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
]


class _TagCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.violations: List[str] = []
        self.cite_sources: List[str] = []
        self.slide_count = 0

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        t = tag.lower()
        if t not in ALLOWED_TAGS:
            self.violations.append(f"disallowed_tag:{t}")
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        for name in attr_map:
            if name not in ALLOWED_ATTRS:
                self.violations.append(f"disallowed_attr:{name}")
            if name.startswith("on"):
                self.violations.append(f"event_handler:{name}")
        if "src" in attr_map and attr_map["src"].startswith(("http://", "https://", "//")):
            if not attr_map["src"].startswith("data:"):
                self.violations.append("external_url")
        if t == "section" and attr_map.get("class", "").find("slide") >= 0:
            self.slide_count += 1
        if t == "span" and "cite" in attr_map.get("class", ""):
            src = attr_map.get("data-source", "")
            if src:
                self.cite_sources.append(src)


def strip_secrets(text: str) -> str:
    out = text
    for pat in SECRET_PATTERNS:
        out = pat.sub("[REDACTED]", out)
    return out


def validate_user_input(message: str, project_id: Optional[str]) -> None:
    if not project_id:
        raise ValueError("No active project context")
    if len(message) > MAX_USER_MESSAGE_CHARS:
        raise ValueError(f"Message exceeds {MAX_USER_MESSAGE_CHARS} characters")


def check_project_cost_ceiling(
    current_cost_usd: float,
    delta_usd: float,
    *,
    project_ceiling_usd: Optional[float] = None,
) -> None:
    ceiling = project_ceiling_usd if project_ceiling_usd is not None else PROJECT_COST_CEILING_USD
    if current_cost_usd + delta_usd > ceiling:
        raise ValueError(f"Project cost ceiling ${ceiling:.2f} exceeded")


def sanitize_html(html: str) -> Tuple[str, List[str]]:
    """Return sanitized html and list of violations (empty if ok)."""
    lower = html.lower()
    if "<script" in lower or "javascript:" in lower:
        return html, ["script_blocked"]
    parser = _TagCollector()
    try:
        parser.feed(html)
    except Exception as exc:
        return html, [f"parse_error:{exc}"]
    return html, parser.violations


def validate_citations_in_html(
    html: str,
    allowed_kb_ids: Set[str],
    session_sources: Optional[Set[str]] = None,
) -> List[str]:
    parser = _TagCollector()
    try:
        parser.feed(html)
    except Exception:
        return ["html_parse_failed"]
    errors: List[str] = []
    session_sources = session_sources or set()
    for src in parser.cite_sources:
        if src.startswith("kb:"):
            asset_id = src[3:]
            if asset_id not in allowed_kb_ids:
                errors.append(f"unresolved_citation:{asset_id}")
        elif src.startswith("session:"):
            if src not in session_sources:
                errors.append(f"unresolved_session:{src}")
        else:
            errors.append(f"invalid_cite_format:{src}")
    return errors


def validate_deck_slide_count(html: str, artifact_type: str, min_slides: int = 2) -> Optional[str]:
    if artifact_type != "deck":
        return None
    parser = _TagCollector()
    try:
        parser.feed(html)
    except Exception:
        return "deck_parse_failed"
    if parser.slide_count < min_slides:
        return f"deck_requires_{min_slides}_slides"
    return None
