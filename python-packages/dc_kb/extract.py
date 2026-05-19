from __future__ import annotations

from pathlib import Path

from dc_kb.chunking import merge_and_split
from dc_kb.extractors.csv_extractor import extract_csv
from dc_kb.extractors.docx_extractor import extract_docx
from dc_kb.extractors.image_extractor import extract_image
from dc_kb.extractors.pdf_extractor import extract_pdf
from dc_kb.extractors.pptx_extractor import extract_pptx
from dc_kb.models import ExtractedDocument


def extract_document(file_path: str, mime_type: str | None = None) -> ExtractedDocument:
    path = Path(file_path)
    ext = path.suffix.lower()
    mime = (mime_type or "").lower()

    if ext == ".pdf" or mime == "application/pdf":
        doc = extract_pdf(path)
    elif ext == ".docx" or "wordprocessingml" in mime:
        doc = extract_docx(path)
    elif ext in (".pptx", ".ppt") or "presentation" in mime or mime == "application/vnd.ms-powerpoint":
        doc = extract_pptx(path)
    elif ext == ".csv" or mime == "text/csv":
        doc = extract_csv(path)
    elif ext in (".png", ".jpg", ".jpeg") or mime.startswith("image/"):
        doc = extract_image(path)
    else:
        raise ValueError(f"Unsupported file type: {ext or mime}")

    doc.chunks = merge_and_split(doc.chunks)
    return doc
