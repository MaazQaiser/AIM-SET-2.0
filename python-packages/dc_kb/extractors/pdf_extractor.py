from __future__ import annotations

from pathlib import Path

from dc_kb.models import ExtractedDocument, TextChunk


def extract_pdf(path: Path) -> ExtractedDocument:
    # Try pymupdf4llm first (best for text-based PDFs)
    try:
        import pymupdf4llm

        md = pymupdf4llm.to_markdown(str(path))
        text = (md or "").strip()
        if text:
            return ExtractedDocument(
                chunks=[TextChunk(text=text, metadata={"source": path.name})],
                metadata={"format": "pdf"},
            )
    except Exception:
        pass

    # Fallback: pymupdf page-by-page text extraction
    try:
        import fitz

        doc = fitz.open(path)
        chunks = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            if text:
                chunks.append(TextChunk(text=text, metadata={"page": i + 1, "source": path.name}))
        if chunks:
            return ExtractedDocument(chunks=chunks, metadata={"format": "pdf", "pages": len(doc)})
    except Exception:
        pass

    # Fallback: OCR for scanned/image-based PDFs
    try:
        from pdf2image import convert_from_path
        import pytesseract

        images = convert_from_path(str(path), dpi=200)
        chunks = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img).strip()
            if text:
                chunks.append(TextChunk(text=text, metadata={"page": i + 1, "source": path.name, "ocr": True}))
        if chunks:
            return ExtractedDocument(chunks=chunks, metadata={"format": "pdf", "ocr": True, "pages": len(images)})
    except Exception:
        pass

    return ExtractedDocument(chunks=[], metadata={"format": "pdf", "warning": "empty"})
