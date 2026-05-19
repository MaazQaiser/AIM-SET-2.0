from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class TextChunk:
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractedDocument:
    chunks: List[TextChunk]
    metadata: Dict[str, Any] = field(default_factory=dict)
