from __future__ import annotations

from pathlib import Path

from dc_kb.models import ExtractedDocument, TextChunk


def extract_image(path: Path) -> ExtractedDocument:
    try:
        from PIL import Image
        import pytesseract

        image = Image.open(path)
        text = pytesseract.image_to_string(image).strip()
        if not text:
            return ExtractedDocument(
                chunks=[],
                metadata={"format": "image", "warning": "no text detected via OCR"},
            )
        return ExtractedDocument(
            chunks=[TextChunk(text=text, metadata={"source": path.name})],
            metadata={"format": "image"},
        )
    except Exception:
        # tesseract not installed, corrupted file, or PIL error — return empty chunks
        # so the caller can create a placeholder entry for this image asset.
        return ExtractedDocument(
            chunks=[],
            metadata={"format": "image", "warning": "OCR extraction failed"},
        )
