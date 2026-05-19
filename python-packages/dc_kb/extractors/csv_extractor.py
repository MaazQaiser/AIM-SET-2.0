from __future__ import annotations

import csv
from pathlib import Path

from dc_kb.models import ExtractedDocument, TextChunk


def extract_csv(path: Path) -> ExtractedDocument:
    chunks: list[TextChunk] = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        batch: list[str] = []
        batch_size = 10
        row_num = 0
        for row in reader:
            row_num += 1
            line = "; ".join(f"{k}: {v}" for k, v in row.items() if v)
            batch.append(line)
            if len(batch) >= batch_size:
                chunks.append(
                    TextChunk(
                        text="\n".join(batch),
                        metadata={"rows": f"{row_num - len(batch) + 1}-{row_num}", "headers": headers},
                    )
                )
                batch = []
        if batch:
            chunks.append(
                TextChunk(
                    text="\n".join(batch),
                    metadata={"rows": f"{row_num - len(batch) + 1}-{row_num}", "headers": headers},
                )
            )
    return ExtractedDocument(chunks=chunks, metadata={"format": "csv", "row_count": row_num})
