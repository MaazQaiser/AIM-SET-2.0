from __future__ import annotations

from typing import List

from dc_kb.models import TextChunk


def split_text(
    text: str,
    *,
    chunk_size: int = 1000,
    overlap: int = 150,
    metadata: dict | None = None,
) -> List[TextChunk]:
    text = (text or "").strip()
    if not text:
        return []
    base_meta = metadata or {}
    if len(text) <= chunk_size:
        return [TextChunk(text=text, metadata=dict(base_meta))]

    chunks: List[TextChunk] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        piece = text[start:end].strip()
        if piece:
            chunks.append(TextChunk(text=piece, metadata={**base_meta, "char_start": start}))
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def merge_and_split(raw_chunks: List[TextChunk], chunk_size: int = 1000, overlap: int = 150) -> List[TextChunk]:
    out: List[TextChunk] = []
    for ch in raw_chunks:
        out.extend(split_text(ch.text, chunk_size=chunk_size, overlap=overlap, metadata=ch.metadata))
    return out
