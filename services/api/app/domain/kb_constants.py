from __future__ import annotations

ALLOWED_EXTENSIONS = {
    ".png",
    ".pdf",
    ".docx",
    ".jpeg",
    ".jpg",
    ".csv",
    ".ppt",
    ".pptx",
}

EXTENSION_MIME = {
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".csv": "text/csv",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

EXTENSION_ASSET_TYPE = {
    ".pdf": "deck",
    ".pptx": "deck",
    ".ppt": "deck",
    ".docx": "one-pager",
    ".csv": "case-study",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
}

ALLOWED_ASSET_TYPES = frozenset(
    {
        "deck",
        "case-study",
        "one-pager",
        "architecture",
        "battlecard",
        "image",
    }
)
