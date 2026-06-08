from __future__ import annotations

from pathlib import Path

from dc_kb.models import ExtractedDocument, TextChunk


def extract_image(path: Path) -> ExtractedDocument:
    try:
        from PIL import Image
        import pytesseract

        image = Image.open(path)
        # Prevent uploads from hanging indefinitely in OCR when the local
        # tesseract binary is slow/unavailable. If OCR times out or fails,
        # caller will fall back to placeholder chunking.
        text = pytesseract.image_to_string(image, timeout=8).strip()
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
