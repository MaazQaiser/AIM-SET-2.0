from __future__ import annotations

import html as html_lib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.domain.content_studio_repository import ContentStudioRepository, get_content_studio_repository
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant

PARENT_TEMPLATE_TAG = "__parent_template__"


def extract_slide_section(html: str, slide_index: int) -> Optional[str]:
    """Return inner HTML for a deck section by data-slide index."""
    if not html or slide_index < 1:
        return None
    pattern = re.compile(
        rf'(<section[^>]*\bdata-slide=["\']?{slide_index}["\']?[^>]*>)(.*?)(</section>)',
        re.DOTALL | re.IGNORECASE,
    )
    match = pattern.search(html)
    if not match:
        return None
    return match.group(0)


def _slide_sections_from_metadata(metadata: Dict[str, Any]) -> Dict[int, str]:
    raw = metadata.get("slide_sections")
    if isinstance(raw, dict):
        out: Dict[int, str] = {}
        for key, value in raw.items():
            try:
                idx = int(str(key))
            except ValueError:
                continue
            if isinstance(value, str) and value.strip():
                out[idx] = value.strip()
        return out
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return _slide_sections_from_metadata({"slide_sections": parsed})
        except json.JSONDecodeError:
            pass
    return {}


def _store_slide_sections_in_metadata(html: str) -> Dict[str, str]:
    """Split deck HTML into per-slide sections for KB metadata storage."""
    sections: Dict[str, str] = {}
    pattern = re.compile(
        r'(<section[^>]*\bdata-slide=["\']?(\d+)["\']?[^>]*>.*?</section>)',
        re.DOTALL | re.IGNORECASE,
    )
    for match in pattern.finditer(html):
        slide_num = int(match.group(2))
        sections[str(slide_num)] = match.group(1)
    return sections


def store_revision_slide_sections(
    ctx: TenantContext,
    asset_id: str,
    html: str,
) -> None:
    """Persist parsed slide sections on a KB asset after Studio export."""
    sections = _store_slide_sections_in_metadata(html)
    if not sections:
        return
    kb_repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    row = kb_repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
    if not row:
        return
    metadata = dict(row.get("metadata") or {})
    metadata["slide_sections"] = sections
    metadata["slide_section_count"] = len(sections)
    kb_repo.update_asset_metadata(tenant_uuid, asset_id, metadata, clerk_key=clerk_key)


def resolve_reuse_slide(
    ctx: TenantContext,
    *,
    source_asset_id: str,
    source_slide_index: int,
    repo: Optional[ContentStudioRepository] = None,
) -> Tuple[Optional[str], str]:
    """Resolve reusable slide HTML from KB metadata, templates, or preview fallback."""
    repo = repo or get_content_studio_repository()
    kb_repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    asset_row = kb_repo.get_asset_row(tenant_uuid, source_asset_id, clerk_key)
    metadata = dict((asset_row or {}).get("metadata") or {})

    sections = _slide_sections_from_metadata(metadata)
    if source_slide_index in sections:
        return sections[source_slide_index], "kb_metadata"

    for template in repo.list_templates(ctx, artifact_type="deck"):
        tpl_html = str(template.get("html") or "")
        section = extract_slide_section(tpl_html, source_slide_index)
        if section and source_asset_id in tpl_html:
            return section, "template"

    latest_rev_html = _latest_revision_html_for_asset(ctx, source_asset_id, repo)
    if latest_rev_html:
        section = extract_slide_section(latest_rev_html, source_slide_index)
        if section:
            return section, "studio_revision"

    preview_count = int((asset_row or {}).get("preview_slide_count") or 0)
    if preview_count >= source_slide_index >= 1:
        heading = html_lib.escape(str((asset_row or {}).get("title") or "Reused slide"))
        asset_esc = html_lib.escape(source_asset_id)
        fallback = (
            f'<section class="slide" data-slide="{source_slide_index}" '
            f'data-reuse-source="kb:{asset_esc}:{source_slide_index}">'
            f'<h2>{heading}</h2>'
            f'<figure><img data-asset-id="{asset_esc}" data-slide="{source_slide_index}" '
            f'alt="Slide {source_slide_index}" style="max-width:100%;max-height:520px;object-fit:contain;" />'
            f'</figure>'
            f'<span class="cite" data-source="kb:{asset_esc}:slide:{source_slide_index}"></span>'
            f"</section>"
        )
        return fallback, "preview_fallback"

    return None, "missing"


def _latest_revision_html_for_asset(
    ctx: TenantContext,
    asset_id: str,
    repo: ContentStudioRepository,
) -> Optional[str]:
    for project in repo.list_projects(ctx):
        brief = project.get("brief") or {}
        kb_ids = brief.get("kb_asset_ids") or []
        if asset_id in kb_ids or str(brief.get("published_kb_asset_id") or "") == asset_id:
            latest = repo.latest_revision(ctx, str(project["id"]))
            if latest and latest.get("html"):
                return str(latest["html"])
    return None


def _extract_slide_sections(html: str) -> List[str]:
    """Return all <section class="slide"> elements from HTML in document order."""
    pattern = re.compile(
        r'<section\b[^>]*\bclass="[^"]*\bslide\b[^"]*"[^>]*>.*?</section>',
        re.DOTALL | re.IGNORECASE,
    )
    return [m.group(0) for m in pattern.finditer(html)]


def _renumber_slide_section(section_html: str, new_num: int) -> str:
    """Replace the data-slide attribute value so all slides are numbered sequentially."""
    return re.sub(
        r'(data-slide=)["\']?\d+["\']?',
        f'\\1"{new_num}"',
        section_html,
        count=1,
        flags=re.IGNORECASE,
    )


def _get_parent_fixed_sections(
    ctx: TenantContext,
    repo: ContentStudioRepository,
) -> Tuple[List[str], List[str]]:
    """Return (fixed_start_sections, fixed_end_sections) from the configured parent template.

    Returns two empty lists when no parent template is set up, so callers can
    safely call this unconditionally — it degrades gracefully.
    """
    try:
        stubs = repo.list_templates(ctx, artifact_type="deck")
        stub = next(
            (t for t in stubs if PARENT_TEMPLATE_TAG in (t.get("tags") or [])),
            None,
        )
        if not stub:
            return [], []

        parent = repo.get_template(ctx, str(stub["id"]))
        if not parent:
            return [], []

        parent_html = str(parent.get("html") or "")
        if not parent_html:
            return [], []

        all_sections = _extract_slide_sections(parent_html)
        if not all_sections:
            return [], []

        # Determine the start/end split from the saved draft metadata when
        # available; otherwise default to 1 fixed-start slide.
        meta = parent.get("metadata") or {}
        draft = meta.get("fixedSlidesDraft") or {}
        fixed_start_slides = draft.get("fixedStartSlides") or []
        n_start = max(1, len(fixed_start_slides)) if fixed_start_slides else 1

        return all_sections[:n_start], all_sections[n_start:]
    except Exception:
        return [], []


def _extract_template_style(template: Optional[Dict[str, Any]]) -> str:
    if not template:
        return ""
    css_vars = template.get("cssVariables") or {}
    if not isinstance(css_vars, dict):
        return ""
    lines = [":root {"]
    for key, value in css_vars.items():
        lines.append(f"  --{key}: {value};")
    lines.append("}")
    return "\n".join(lines)


def merge_slide_plan_to_html(
    ctx: TenantContext,
    *,
    title: str,
    slide_plan: List[Dict[str, Any]],
    template: Optional[Dict[str, Any]] = None,
    generated_sections: Optional[Dict[int, str]] = None,
    repo: Optional[ContentStudioRepository] = None,
    artifact_type: str = "deck",
) -> str:
    """Assemble a full deck HTML from slide plan items (reuse + generated sections)."""
    repo = repo or get_content_studio_repository()
    generated_sections = generated_sections or {}
    sections: List[str] = []

    for index, item in enumerate(slide_plan, start=1):
        if not isinstance(item, dict):
            continue
        slide_num = int(item.get("slide") or index)
        mode = str(item.get("mode") or "generate").lower()
        section_html: Optional[str] = None

        if mode in ("reuse", "hybrid"):
            reuse = item.get("reuse") or {}
            if isinstance(reuse, dict):
                source_id = str(reuse.get("source_asset_id") or "").strip()
                source_idx = int(reuse.get("source_slide_index") or 0)
                if source_id and source_idx > 0:
                    section_html, _ = resolve_reuse_slide(
                        ctx,
                        source_asset_id=source_id,
                        source_slide_index=source_idx,
                        repo=repo,
                    )

        if not section_html and slide_num in generated_sections:
            section_html = generated_sections[slide_num]

        if not section_html:
            heading = html_lib.escape(str(item.get("heading") or f"Slide {slide_num}"))
            body = html_lib.escape(str(item.get("body") or item.get("intent") or ""))
            evidence = item.get("evidence_refs") or []
            cite = ""
            if isinstance(evidence, list) and evidence:
                cite_ref = html_lib.escape(str(evidence[0]))
                cite = f'<span class="cite" data-source="{cite_ref}"></span>'
            section_html = (
                f'<section class="slide" data-slide="{slide_num}">'
                f"<h2>{heading}</h2><p>{body}</p>{cite}</section>"
            )

        if mode == "hybrid" and slide_num in generated_sections:
            gen = generated_sections[slide_num]
            inner = re.sub(r"^<section[^>]*>|</section>$", "", gen.strip(), flags=re.IGNORECASE)
            section_html = re.sub(
                r"(</section>)\s*$",
                inner + r"\1",
                section_html,
                count=1,
                flags=re.IGNORECASE,
            )

        sections.append(section_html)

    # Inject parent-template fixed slides only for deck artifacts.
    # The helper returns empty lists when no parent template is configured, so
    # this is a no-op for tenants that haven't set one up.
    parent_start, parent_end = (
        _get_parent_fixed_sections(ctx, repo) if artifact_type == "deck" else ([], [])
    )

    # Renumber all sections sequentially: parent-start → user → parent-end.
    merged: List[str] = []
    counter = 1
    for s in parent_start:
        merged.append(_renumber_slide_section(s, counter))
        counter += 1
    for s in sections:
        merged.append(_renumber_slide_section(s, counter))
        counter += 1
    for s in parent_end:
        merged.append(_renumber_slide_section(s, counter))
        counter += 1

    style = _extract_template_style(template)
    body = "\n".join(merged)
    return (
        f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>body{{margin:0;background:#fff;font-family:Urbanist,sans-serif}}"
        f".slide{{width:1280px;aspect-ratio:16/9;padding:48px;box-sizing:border-box;margin:0 auto 16px;}}"
        f"{style}</style></head><body>{body}</body></html>"
    )


def slide_plan_to_outline(slide_plan: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert suggestion_plan slide_plan to legacy slide_outline format."""
    outline: List[Dict[str, Any]] = []
    for item in slide_plan:
        if not isinstance(item, dict):
            continue
        entry = {
            "slide": int(item.get("slide") or len(outline) + 1),
            "heading": str(item.get("heading") or ""),
            "body": str(item.get("body") or item.get("intent") or ""),
            "visual": str(item.get("visual") or ""),
            "mode": str(item.get("mode") or "generate"),
        }
        if item.get("evidence_refs"):
            refs = item["evidence_refs"]
            if isinstance(refs, list) and refs:
                entry["citation_source"] = str(refs[0])
        if item.get("data_points"):
            points = item["data_points"]
            if isinstance(points, list) and points:
                entry["evidence"] = "; ".join(str(p) for p in points[:3])[:180]
        if item.get("reuse"):
            entry["reuse"] = item["reuse"]
        outline.append(entry)
    return outline
