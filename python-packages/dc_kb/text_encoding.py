from __future__ import annotations

# Encodings tried in order for user-uploaded text (Excel exports are often cp1252).
_TEXT_ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "latin-1")


def decode_text_bytes(data: bytes) -> str:
    """Decode uploaded text bytes, tolerating Windows-1252 and Latin-1 exports."""
    if not data:
        return ""
    for encoding in _TEXT_ENCODINGS:
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    # latin-1 accepts every byte; kept for completeness.
    return data.decode("latin-1")
