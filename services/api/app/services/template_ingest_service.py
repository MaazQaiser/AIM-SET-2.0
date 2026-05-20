from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.config import get_settings
from app.domain.agent_runtime import get_content_generation_runtime
from app.domain.content_studio_repository import get_content_studio_repository

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"


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
    """Rasterize source file and run vision LLM per page."""
    repo = get_content_studio_repository()
    settings = get_settings()
    file_bytes = repo.download_template_source(ctx, storage_path)
    ext = Path(storage_path).suffix.lower()

    try:
        page_images = _rasterize(file_bytes, ext)
        if not page_images:
            raise ValueError("No pages could be rasterized")

        system = load_vision_prompt()
        runtime = get_content_generation_runtime(ctx)
        client = LlmClient(api_key=settings.anthropic_api_key or None)
        sections: List[str] = []
        all_vars: Dict[str, str] = {}

        for i, png in enumerate(page_images, start=1):
            completion = client.complete_vision(
                system=system,
                image_png_bytes=png,
                user_text=f"Slide number: {i}. Emit <section class=\"slide\" data-slide=\"{i}\">...</section>",
                max_tokens=4096,
                model=runtime["model_name"],
                fallback_model=runtime["fallback_model_name"],
            )
            section_html = _clean_section(completion.text, i)
            sections.append(section_html)
            all_vars.update(_extract_css_vars(section_html))

        merged = _merge_template_html(sections, all_vars)
        thumb = page_images[0] if page_images else None
        return repo.finalize_template(
            ctx,
            template_id,
            html=merged,
            css_variables=all_vars,
            page_count=len(page_images),
            thumbnail_bytes=thumb,
        )
    except Exception as exc:
        repo.finalize_template(
            ctx,
            template_id,
            html="",
            css_variables={},
            page_count=0,
            error=str(exc)[:500],
        )
        raise


def _rasterize(file_bytes: bytes, ext: str) -> List[bytes]:
    if ext in {".png", ".jpg", ".jpeg"}:
        return [file_bytes]

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        src = tmp_path / f"source{ext}"
        src.write_bytes(file_bytes)
        pdf_path = src

        if ext in {".pptx", ".ppt"}:
            pdf_path = _convert_office_to_pdf(src, tmp_path)
        elif ext != ".pdf":
            raise ValueError(f"Unsupported extension: {ext}")

        return _pdf_to_pngs(pdf_path)


def _convert_office_to_pdf(src: Path, work_dir: Path) -> Path:
    try:
        subprocess.run(
            [
                "soffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(work_dir),
                str(src),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        pdf = work_dir / f"{src.stem}.pdf"
        if pdf.is_file():
            return pdf
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    try:
        from pptx import Presentation  # type: ignore

        if src.suffix.lower() in {".pptx", ".ppt"}:
            return _pptx_fallback_raster_via_pillow(src)
    except Exception:
        pass

    raise ValueError("Could not convert presentation to PDF (install LibreOffice or use PDF/PNG upload)")


def _pptx_fallback_raster_via_pillow(src: Path) -> Path:
    """Fallback: export slide text placeholders as single-page PDF via pymupdf."""
    import fitz  # type: ignore
    from pptx import Presentation  # type: ignore

    prs = Presentation(str(src))
    doc = fitz.open()
    for slide in prs.slides:
        page = doc.new_page(width=1280, height=720)
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                texts.append(shape.text[:200])
        page.insert_text((40, 40), "\n".join(texts[:8]) or "Slide", fontsize=14)
    out = src.parent / f"{src.stem}_fallback.pdf"
    doc.save(str(out))
    doc.close()
    return out


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
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
        f"<style>:root {{\n{root_vars}\n}}\n"
        "section.slide { aspect-ratio: 16/9; max-width: 1280px; margin: 0 auto; }</style>"
        f"</head><body>{body}</body></html>"
    )
