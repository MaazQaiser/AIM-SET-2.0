from __future__ import annotations

from pathlib import Path

from dc_kb.models import ExtractedDocument, TextChunk


def extract_pdf(path: Path) -> ExtractedDocument:
    try:
        import pymupdf4llm
    except ImportError:
        import fitz  # pymupdf fallback

        doc = fitz.open(path)
        chunks = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            if text:
                chunks.append(TextChunk(text=text, metadata={"page": i + 1, "source": path.name}))
        return ExtractedDocument(chunks=chunks, metadata={"format": "pdf", "pages": len(doc)})

    md = pymupdf4llm.to_markdown(str(path))
    text = (md or "").strip()
    if not text:
        return ExtractedDocument(chunks=[], metadata={"format": "pdf", "warning": "empty"})
    return ExtractedDocument(
        chunks=[TextChunk(text=text, metadata={"source": path.name})],
        metadata={"format": "pdf"},
    )
