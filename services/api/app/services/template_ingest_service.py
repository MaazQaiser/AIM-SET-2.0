from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.config import get_settings
from app.domain.agent_runtime import get_content_generation_runtime
from app.domain.content_studio_repository import get_content_studio_repository
from app.domain.tenant_service import get_tenant_service
from app.services.office_preview import (
    convert_office_bytes_to_pdf,
    rasterize_presentation_slides,
)

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"


def _template_preview_pdf_path(template_id: str, tenant_uuid: str) -> str:
    return f"{tenant_uuid}/{template_id}/preview.pdf"


def load_vision_prompt() -> str:
    path = PROMPTS_ROOT / "content/template_vision/v1.0.0.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "Convert this slide to HTML/CSS section."


def process_template_ingest(
    ctx: TenantContext,
    template_id: str,
    storage_path: str,
) -> Dict[str, Any]:
    """Rasterize the uploaded source file, persist slide previews, then optionally convert to HTML."""
    repo = get_content_studio_repository()
    settings = get_settings()
    tenant_uuid, _ = get_tenant_service().resolve(ctx)
    file_bytes = repo.download_template_source(ctx, storage_path)
    ext = Path(storage_path).suffix.lower()

    page_images, preview_pdf = _prepare_visual_assets(repo, tenant_uuid, template_id, file_bytes, ext)
    if not page_images and not preview_pdf:
        repo.finalize_template(
            ctx,
            template_id,
            html="",
            css_variables={},
            page_count=0,
            error="No pages could be rasterized from the uploaded file",
        )
        raise ValueError("No pages could be rasterized")

    if page_images:
        repo.save_template_preview_slides(ctx, template_id, page_images)
    thumb = page_images[0] if page_images else None
    page_count = len(page_images) if page_images else 1

    try:
        if not page_images:
            raise ValueError("Slide PNGs unavailable; using PDF preview only")

        system = load_vision_prompt()
        runtime = get_content_generation_runtime(ctx)
        client = LlmClient(api_key=settings.llm_api_key or None)
        sections: List[str] = []
        all_vars: Dict[str, str] = {}

        for i, png in enumerate(page_images, start=1):
            completion = client.complete_vision(
                system=system,
                image_png_bytes=png,
                user_text=f'Slide number: {i}. Emit <section class="slide" data-slide="{i}">...</section>',
                max_tokens=4096,
                model=runtime["model_name"],
                fallback_model=runtime["fallback_model_name"],
            )
            section_html = _clean_section(completion.text, i)
            sections.append(section_html)
            all_vars.update(_extract_css_vars(section_html))

        merged = _merge_template_html(sections, all_vars)
        return repo.finalize_template(
            ctx,
            template_id,
            html=merged,
            css_variables=all_vars,
            page_count=page_count,
            thumbnail_bytes=thumb,
        )
    except Exception as exc:
        return repo.finalize_template(
            ctx,
            template_id,
            html="",
            css_variables={},
            page_count=page_count,
            thumbnail_bytes=thumb,
            error=str(exc)[:500],
        )


def ensure_template_preview_slides(ctx: TenantContext, template_id: str) -> int:
    """Rebuild slide PNG previews from the stored source file when missing."""
    repo = get_content_studio_repository()
    row = repo.get_template_row(ctx, template_id)
    storage_path = repo.resolve_template_source_path(ctx, template_id)
    if not storage_path:
        return 0

    slide_count = int((row or {}).get("page_count") or 0)
    if slide_count > 0:
        try:
            repo.download_template_slide(ctx, template_id, 1)
            return slide_count
        except FileNotFoundError:
            pass

    tenant_uuid, _ = get_tenant_service().resolve(ctx)
    file_bytes = repo.download_template_source(ctx, storage_path)
    ext = Path(storage_path).suffix.lower()
    page_images, _ = _prepare_visual_assets(repo, tenant_uuid, template_id, file_bytes, ext)
    if not page_images:
        return 1 if repo.get_template_preview_pdf(ctx, template_id) else 0

    saved = repo.save_template_preview_slides(ctx, template_id, page_images)
    return saved


def _prepare_visual_assets(
    repo,
    tenant_uuid: str,
    template_id: str,
    file_bytes: bytes,
    ext: str,
) -> tuple[List[bytes], bool]:
    preview_pdf = False
    page_images: List[bytes] = []

    if ext in {".png", ".jpg", ".jpeg"}:
        return [file_bytes], False

    if ext in {".ppt", ".pptx"}:
        try:
            pdf_bytes = convert_office_bytes_to_pdf(file_bytes, ext, allow_text_fallback=True)
            repo.upload_template_blob(
                _template_preview_pdf_path(template_id, tenant_uuid),
                pdf_bytes,
                content_type="application/pdf",
            )
            preview_pdf = True
        except Exception:
            preview_pdf = False

        try:
            page_images = rasterize_presentation_slides(file_bytes, ext)
            return page_images, preview_pdf
        except Exception:
            if preview_pdf:
                return [], True
            raise

    if ext == ".pdf":
        repo.upload_template_blob(
            _template_preview_pdf_path(template_id, tenant_uuid),
            file_bytes,
            content_type="application/pdf",
        )
        return _pdf_to_pngs_from_bytes(file_bytes), True

    raise ValueError(f"Unsupported extension: {ext}")


def _pdf_to_pngs_from_bytes(file_bytes: bytes) -> List[bytes]:
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "source.pdf"
        pdf_path.write_bytes(file_bytes)
        return _pdf_to_pngs(pdf_path)


def _pdf_to_pngs(pdf_path: Path) -> List[bytes]:
    try:
        from pdf2image import convert_from_path  # type: ignore

        images = convert_from_path(str(pdf_path), dpi=150)
        out: List[bytes] = []
        for img in images:
            import io

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            out.append(buf.getvalue())
        return out
    except Exception:
        pass

    try:
        import fitz  # type: ignore

        doc = fitz.open(str(pdf_path))
        out = []
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            out.append(pix.tobytes("png"))
        doc.close()
        return out
    except Exception as exc:
        raise ValueError(f"PDF rasterize failed: {exc}") from exc


def _clean_section(text: str, slide_num: int) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    if "<section" not in text.lower():
        text = f'<section class="slide" data-slide="{slide_num}">{text}</section>'
    return text


def _extract_css_vars(html: str) -> Dict[str, str]:
    vars_found: Dict[str, str] = {}
    for m in re.finditer(r"--([a-zA-Z0-9\-]+)\s*:\s*([^;]+);", html):
        vars_found[f"--{m.group(1)}"] = m.group(2).strip()
    return vars_found


def _merge_template_html(sections: List[str], css_variables: Dict[str, str]) -> str:
    root_vars = "\n".join(f"  {k}: {v};" for k, v in css_variables.items())
    body = "\n".join(sections)
    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8">'
        f"<style>:root {{\n{root_vars}\n}}\n"
        "section.slide { aspect-ratio: 16/9; max-width: 1280px; margin: 0 auto; }</style>"
        f"</head><body>{body}</body></html>"
    )
