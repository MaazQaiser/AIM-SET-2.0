from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class Citation(BaseModel):
    source_type: str
    source_id: str
    snippet: str = ""
    confidence: float = 0.0


class AgentEnvelope(BaseModel):
    agent: str
    operation: str
    result: Dict[str, Any]
    citations: List[Citation] = Field(default_factory=list)
    confidence: float = 0.0
    cost: Dict[str, Any] = Field(default_factory=dict)
    trace_id: str
    creative: bool = False


def validate_envelope(envelope: AgentEnvelope) -> None:
    if envelope.creative:
        return
    if not envelope.citations and _requires_citations(envelope.operation):
        raise ValueError(f"Operation {envelope.operation} requires citations")
    for c in envelope.citations:
        if not c.source_id:
            raise ValueError("Citation missing source_id")


def _requires_citations(operation: str) -> bool:
    return operation not in (
        "health_check",
        "ping",
        "studio_ask",
        "template_recommend",
        "studio_refuse",
        "intent_snapshot",
        "sentiment_update",
    )
