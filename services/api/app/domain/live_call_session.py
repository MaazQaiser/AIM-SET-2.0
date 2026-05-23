from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from dc_tools.salient_keywords import is_salient_term


@dataclass
class BriefContext:
    pains: List[Dict[str, Any]] = field(default_factory=list)
    discovery_questions: List[str] = field(default_factory=list)
    account_name: str = ""


@dataclass
class LiveCallSession:
    call_id: str
    tenant_key: str
    keyword_counts: Dict[str, Dict[str, int]] = field(default_factory=dict)
    top_keywords: List[Dict[str, Any]] = field(default_factory=list)
    current_intent: Dict[str, Any] = field(
        default_factory=lambda: {
            "label": "general_discovery",
            "confidence": 0.5,
            "evidence": "",
        }
    )
    detected_pains: List[Dict[str, Any]] = field(default_factory=list)
    sentiment_series: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    sentiment_shift: Optional[Dict[str, Any]] = None
    focus_areas: List[str] = field(default_factory=list)
    brief_context: BriefContext = field(default_factory=BriefContext)
    last_ae_score: float = 0.0
    last_customer_score: float = 0.0
    customer_recent_scores: List[float] = field(default_factory=list)
    segment_count: int = 0
    topic_spike_counts: Dict[str, int] = field(default_factory=dict)
    kb_suggestions_emitted: set[str] = field(default_factory=set)

    def to_snapshot(self) -> Dict[str, Any]:
        return {
            "intent": self.current_intent,
            "focus_areas": self.focus_areas,
            "pains": self.detected_pains,
            "top_keywords": self.top_keywords,
            "keyword_stats": self.keyword_stats_payload(),
            "sentiment_ae": self.last_ae_score,
            "sentiment_customer": self.last_customer_score,
            "sentiment_shift": self.sentiment_shift,
        }

    def keyword_stats_payload(self) -> Dict[str, Any]:
        global_counts: Dict[str, int] = {}
        for speaker_counts in self.keyword_counts.values():
            for term, count in speaker_counts.items():
                global_counts[term] = global_counts.get(term, 0) + count
        global_top = sorted(
            [{"term": t, "count": c} for t, c in global_counts.items() if is_salient_term(t)],
            key=lambda x: x["count"],
            reverse=True,
        )[:10]
        by_speaker = {
            sid: sorted(
                [{"term": t, "count": c} for t, c in counts.items() if is_salient_term(t)],
                key=lambda x: x["count"],
                reverse=True,
            )[:8]
            for sid, counts in self.keyword_counts.items()
            if any(is_salient_term(t) for t in counts)
        }
        return {"by_speaker": by_speaker, "global_top": global_top}


_sessions: Dict[str, LiveCallSession] = {}


def session_key(tenant_key: str, call_id: str) -> str:
    return f"{tenant_key}:{call_id}"


def get_live_session(tenant_key: str, call_id: str) -> LiveCallSession:
    key = session_key(tenant_key, call_id)
    if key not in _sessions:
        _sessions[key] = LiveCallSession(call_id=call_id, tenant_key=tenant_key)
    return _sessions[key]


def clear_live_session(tenant_key: str, call_id: str) -> Optional[Dict[str, Any]]:
    key = session_key(tenant_key, call_id)
    session = _sessions.pop(key, None)
    if session:
        return session.to_snapshot()
    return None
