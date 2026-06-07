from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Tuple

from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.config import get_settings
from app.domain.agent_runtime import get_content_generation_runtime
from app.domain.content_studio_guardrails import sanitize_html, strip_secrets


def split_template_parts(raw_html: str) -> Tuple[str, str]:
    value = _normalize_code_text(raw_html)
    if not value:
        return "", ""

    css_blocks = re.findall(r"<style[^>]*>([\s\S]*?)</style>", value, flags=re.IGNORECASE)
    without_styles = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", value, flags=re.IGNORECASE).strip()
    body_match = re.search(r"<body[^>]*>([\s\S]*?)</body>", without_styles, flags=re.IGNORECASE)
    body = body_match.group(1).strip() if body_match else without_styles
    body = re.sub(r"<!doctype[^>]*>", "", body, flags=re.IGNORECASE).strip()
    body = re.sub(r"</?(html|head)[^>]*>", "", body, flags=re.IGNORECASE).strip()
    return body, "\n\n".join(block.strip() for block in css_blocks if block.strip())


def build_template_document(html: str, css: str) -> str:
    body, extracted_css = split_template_parts(html)
    css_text = _normalize_css(css or extracted_css)
    body = body or _starter_body()
    return (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<style>{css_text}</style></head><body>{body}</body></html>"
    )


def extract_css_variables(css: str) -> Dict[str, str]:
    vars_found: Dict[str, str] = {}
    for m in re.finditer(r"--([a-zA-Z0-9\-]+)\s*:\s*([^;]+);", css):
        vars_found[f"--{m.group(1)}"] = m.group(2).strip()
    return vars_found


def count_template_pages(html: str, artifact_type: str) -> int:
    if artifact_type == "deck":
        matches = re.findall(r"<section[^>]*class=[\"'][^\"']*\bslide\b", html, flags=re.IGNORECASE)
        return max(1, len(matches))
    return 1


def validate_template_html(html: str, css: str) -> None:
    css_violations = _css_violations(css)
    if css_violations:
        raise ValueError(f"CSS guardrail violations: {css_violations}")
    _, html_violations = sanitize_html(build_template_document(html, css))
    if html_violations:
        raise ValueError(f"HTML guardrail violations: {html_violations}")


def assist_template_edit(
    ctx: TenantContext,
    *,
    name: str,
    artifact_type: str,
    html: str,
    css: str,
    instruction: str,
) -> Dict[str, Any]:
    clean_instruction = strip_secrets(instruction).strip()
    if not clean_instruction:
        raise ValueError("Instruction is required")
    if len(clean_instruction) > 4000:
        raise ValueError("Instruction exceeds 4000 characters")

    current_html, extracted_css = split_template_parts(html)
    current_html = current_html or _starter_body()
    current_css = _normalize_css(css or extracted_css or _starter_css())
    validate_template_html(current_html, current_css)

    runtime = get_content_generation_runtime(ctx)
    model = _chat_model(runtime)
    system = (
        "You are a precise HTML/CSS template editor for a sales content studio. "
        "Modify the provided template according to the user's instruction. "
        "Return JSON only with keys html, css, and message. "
        "html must be body markup only, not a full document. css must be plain CSS only. "
        "Do not include scripts, event handlers, iframes, external URLs, @import, or markdown fences. "
        "Use Urbanist as the sans-serif font family for all generated or edited template CSS. "
        "Preserve useful existing structure and class names unless the instruction asks to change them. "
        "If the user asks to generate, create, build, redesign, or start over, you may replace the full template. "
        "Use polished production styling: CSS variables, clear hierarchy, 8px or smaller radii, balanced spacing, "
        "good contrast, and a complete deck/one-pager/image layout appropriate to artifact_type."
    )
    user = json.dumps(
        {
            "template_name": name,
            "artifact_type": artifact_type,
            "instruction": clean_instruction,
            "html": current_html,
            "css": current_css,
        },
        ensure_ascii=False,
    )

    settings = get_settings()
    completion = LlmClient(openai_api_key=settings.openai_api_key or None).complete(
        system=system,
        user=user,
        max_tokens=4096,
        model=model,
        fallback_model=runtime.get("fallback_model_name") or "gpt-5.4-mini",
    )
    data = _parse_json_object(completion.text)
    if not data:
        if _is_generation_request(clean_instruction):
            data = _fallback_template_generate(artifact_type, clean_instruction)
        else:
            data = _fallback_template_edit(current_html, current_css, clean_instruction)

    next_html, css_from_html = split_template_parts(str(data.get("html") or current_html))
    next_css = _normalize_css(str(data.get("css") or current_css or css_from_html))
    next_html = next_html or current_html
    validate_template_html(next_html, next_css)

    return {
        "html": next_html,
        "css": next_css,
        "message": str(data.get("message") or "Updated the template draft."),
        "model": completion.model,
        "costUsd": completion.cost_usd,
    }


def _normalize_code_text(value: str) -> str:
    text = (value or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:html|css|json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict) and isinstance(parsed.get("html"), str):
                text = parsed["html"]
        except json.JSONDecodeError:
            pass
    return text.strip()


def _normalize_css(css: str) -> str:
    text = _normalize_code_text(css)
    return re.sub(r"</?style[^>]*>", "", text, flags=re.IGNORECASE).strip()


def _css_violations(css: str) -> List[str]:
    lower = css.lower()
    violations = []
    for token in ["@import", "url(", "expression(", "javascript:", "<script", "</style"]:
        if token in lower:
            violations.append(token)
    return violations


def _parse_json_object(text: str) -> Dict[str, Any] | None:
    raw = text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw).strip()
    if not raw.startswith("{"):
        match = re.search(r"\{[\s\S]*\}", raw)
        raw = match.group(0) if match else raw
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _chat_model(runtime: Dict[str, Any]) -> str:
    for key in ("model_name", "fallback_model_name"):
        model = str(runtime.get(key) or "")
        if model.startswith("gpt-"):
            return model
    return "gpt-5.4-mini"


def _fallback_template_edit(html: str, css: str, instruction: str) -> Dict[str, str]:
    lower = instruction.lower()
    color = _extract_color(instruction)
    additions: List[str] = []

    if color and ("background" in lower or "bg" in lower):
        additions.append(f"body, .template-root, .slide {{ background: {color}; }}")
    elif color and "border" in lower:
        additions.append(f".slide, article, figure {{ border-color: {color}; }}")
    elif color:
        additions.append(f"body, .template-root, .slide {{ color: {color}; }}")

    if "round" in lower:
        additions.append(".slide, article, figure, .card { border-radius: 8px; overflow: hidden; }")
    if "shadow" in lower:
        additions.append(".slide, article, figure, .card { box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16); }")
    if "center" in lower:
        additions.append(".slide, article, figure { text-align: center; }")
    if "bigger" in lower or "larger" in lower:
        additions.append("h1 { font-size: clamp(42px, 5vw, 72px); }")

    if not additions:
        additions.append(".slide, article, figure { outline: 2px solid rgba(37, 99, 235, 0.18); }")

    next_css = "\n\n".join([css.strip(), "/* Agent edit */", *additions]).strip()
    return {
        "html": html,
        "css": next_css,
        "message": "Updated the CSS draft locally. Add an OpenAI API key for richer model edits.",
    }


def _fallback_template_generate(artifact_type: str, instruction: str) -> Dict[str, str]:
    color = _extract_color(instruction) or "#2563eb"
    dark = any(word in instruction.lower() for word in ("dark", "navy", "black", "midnight"))
    if artifact_type == "one_pager":
        html = (
            '<article class="template-root one-pager">'
            '<header class="hero"><div class="eyebrow">One pager</div><h1>Executive brief template</h1>'
            "<p>Frame the buyer problem, recommendation, and business impact in a concise narrative.</p></header>"
            '<section class="summary-grid">'
            '<div><h2>Problem</h2><p>Describe the operational friction and why it matters now.</p></div>'
            '<div><h2>Approach</h2><p>Show the recommended path, proof, and buyer-specific fit.</p></div>'
            '<div><h2>Outcome</h2><p>Connect the solution to measurable business value.</p></div>'
            "</section>"
            '<section class="proof-band"><h2>Proof points</h2><ul><li>Customer evidence</li><li>Business metric</li><li>Next decision</li></ul></section>'
            "</article>"
        )
    elif artifact_type == "image":
        html = (
            '<figure class="template-root image-card">'
            '<div class="eyebrow">Campaign visual</div><h1>Bold message goes here</h1>'
            "<figcaption>Use this composition for a single high-impact image or social tile.</figcaption>"
            "</figure>"
        )
    else:
        html = (
            '<section class="slide template-root cover-slide" data-slide="1">'
            '<div class="eyebrow">Sales narrative</div><h1>Executive deck template</h1>'
            "<p>Set context, urgency, and the decision this deck should drive.</p>"
            '<div class="metric-row"><div><strong>01</strong><span>Problem</span></div><div><strong>02</strong><span>Approach</span></div><div><strong>03</strong><span>Outcome</span></div></div>'
            "</section>"
            '<section class="slide template-root content-slide" data-slide="2">'
            "<h2>Problem and impact</h2><p>Explain the current-state friction and business cost.</p>"
            '<div class="two-col"><article><h3>Current state</h3><p>Manual work, delays, risk, or missed revenue.</p></article><article><h3>Future state</h3><p>Clear path to a measurable improvement.</p></article></div>'
            "</section>"
            '<section class="slide template-root closing-slide" data-slide="3">'
            "<h2>Recommended next steps</h2><ol><li>Confirm priority use case</li><li>Align stakeholders</li><li>Approve next action</li></ol>"
            "</section>"
        )

    background = "#0f172a" if dark else "#f8fafc"
    surface = "#111827" if dark else "#ffffff"
    text = "#f8fafc" if dark else "#0f172a"
    muted = "#cbd5e1" if dark else "#64748b"
    border = "rgba(255,255,255,0.16)" if dark else "#e2e8f0"
    css = (
        f":root {{ --bg: {background}; --surface: {surface}; --text: {text}; --muted: {muted}; --accent: {color}; --border: {border}; }}\n"
        "body { margin: 0; background: var(--bg); color: var(--text); font-family: Urbanist, Arial, sans-serif; }\n"
        ".template-root { box-sizing: border-box; background: var(--surface); color: var(--text); }\n"
        ".slide { width: 1280px; min-height: 720px; margin: 0 auto; padding: 58px; aspect-ratio: 16 / 9; overflow: hidden; }\n"
        ".eyebrow { color: var(--accent); font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }\n"
        "h1 { max-width: 820px; margin: 20px 0 18px; font-size: 62px; line-height: 1.02; }\n"
        "h2 { margin: 0 0 18px; font-size: 44px; line-height: 1.08; }\n"
        "h3 { margin: 0 0 8px; font-size: 22px; }\n"
        "p, li, figcaption { color: var(--muted); font-size: 22px; line-height: 1.42; }\n"
        ".metric-row, .summary-grid, .two-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 42px; }\n"
        ".two-col { grid-template-columns: repeat(2, 1fr); }\n"
        ".metric-row div, .summary-grid div, article { border: 1px solid var(--border); border-radius: 8px; padding: 22px; background: color-mix(in srgb, var(--surface) 88%, var(--accent)); }\n"
        ".metric-row strong { display: block; color: var(--accent); font-size: 30px; }\n"
        ".metric-row span { color: var(--muted); font-size: 16px; }\n"
        ".one-pager { max-width: 980px; margin: 0 auto; padding: 56px; min-height: 1180px; }\n"
        ".hero { border-bottom: 1px solid var(--border); padding-bottom: 34px; }\n"
        ".proof-band { margin-top: 34px; border: 1px solid var(--border); border-radius: 8px; padding: 26px; }\n"
        ".image-card { width: 1080px; height: 1080px; margin: 0 auto; padding: 78px; display: flex; flex-direction: column; justify-content: center; }\n"
    )
    return {
        "html": html,
        "css": css,
        "message": "Generated a polished starter template locally. Add an OpenAI API key for richer generation.",
    }


def _is_generation_request(text: str) -> bool:
    return bool(re.search(r"\b(generate|create|build|design|redesign|start over|from scratch)\b", text, re.IGNORECASE))


def _extract_color(text: str) -> str | None:
    match = re.search(r"#[0-9a-fA-F]{3,8}", text)
    if match:
        return match.group(0)
    colors = {
        "red": "#dc2626",
        "blue": "#2563eb",
        "green": "#16a34a",
        "yellow": "#ca8a04",
        "purple": "#7c3aed",
        "pink": "#db2777",
        "orange": "#ea580c",
        "black": "#111827",
        "white": "#ffffff",
        "gray": "#64748b",
        "grey": "#64748b",
        "navy": "#1e3a8a",
    }
    lowered = text.lower()
    for name, value in colors.items():
        if re.search(rf"\b{name}\b", lowered):
            return value
    return None


def _starter_body() -> str:
    return (
        '<section class="slide template-root" data-slide="1">'
        '<div class="eyebrow">Template</div>'
        "<h1>Executive Narrative</h1>"
        "<p>Use this layout as a reusable structure for generated content.</p>"
        '<div class="grid">'
        '<article class="card"><h2>Problem</h2><p>Frame the current state.</p></article>'
        '<article class="card"><h2>Approach</h2><p>Show the recommended path.</p></article>'
        '<article class="card"><h2>Outcome</h2><p>Make the business impact clear.</p></article>'
        "</div>"
        "</section>"
    )


def _starter_css() -> str:
    return (
        ":root { --bg: #f8fafc; --surface: #ffffff; --text: #0f172a; --muted: #64748b; --accent: #2563eb; }\n"
        "body { margin: 0; background: var(--bg); color: var(--text); font-family: Urbanist, Arial, sans-serif; }\n"
        ".slide { box-sizing: border-box; width: 1280px; min-height: 720px; margin: 0 auto; padding: 56px; background: var(--surface); }\n"
        ".eyebrow { color: var(--accent); font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }\n"
        "h1 { max-width: 760px; margin: 18px 0; font-size: 58px; line-height: 1.02; }\n"
        "p { color: var(--muted); font-size: 22px; line-height: 1.45; }\n"
        ".grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 42px; }\n"
        ".card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #f8fafc; }\n"
        ".card h2 { margin: 0 0 8px; font-size: 24px; }\n"
        ".card p { margin: 0; font-size: 17px; }"
    )
