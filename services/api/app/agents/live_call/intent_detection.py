from __future__ import annotations

import re
import uuid
import logging
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional

from dc_core.evidence import Citation
from dc_core.tenancy import TenantContext
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.config import get_settings
from app.domain.agent_config_repository import get_agent_config_repository
from app.domain.calls_service import CallsService
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_session import BriefContext, LiveCallSession, get_live_session
from app.domain.memory_store import get_memory_store
from dc_tools.salient_keywords import filter_salient_terms, is_salient_term

from app.tools.keyword_extract import extract_keywords
from app.tools.sentiment import analyze_sentiment

_INTENT_FROM_SIGNAL = {
    "budget_signal": "commercial_discovery",
    "competitor_mentioned": "competitive_evaluation",
    "technical_question": "technical_deep_dive",
    "timeline_signal": "timeline_planning",
    "design_query": "design_exploration",
    "objection_raised": "objection_handling",
    "prospect_question": "discovery_q_and_a",
}

_INTENT_DISPLAY: Dict[str, str] = {
    "commercial_discovery": "Budget & commercial discovery",
    "competitive_evaluation": "Competitive evaluation",
    "technical_deep_dive": "Technical deep dive",
    "timeline_planning": "Timeline & go-live planning",
    "design_exploration": "Design exploration",
    "objection_handling": "Objection handling",
    "discovery_q_and_a": "Discovery Q&A",
    "topic_focus": "Topic focus",
    "general_discovery": "General discovery",
}

_PAIN_EMERGENT_PATTERNS = [
    r"\b(struggle|struggling|pain|problem|challenge|frustrat|difficult|blocked|bottleneck)\b",
    r"\b(can't|cannot|unable to|hard to|too slow|too expensive)\b",
    r"\b(manual|spreadsheet|spreadsheets|workaround|rework|visibility gap|requirements?|not sure|unclear)\b",
]

_TOPIC_SPIKE_THRESHOLD = 3
_logger = logging.getLogger(__name__)


def _fallback_tenant_key(ctx: TenantContext) -> str:
    return ctx.clerk_org_id or ctx.tenant_id or ctx.user_id or "local-dev"


def _resolve_live_session(ctx: TenantContext, call_id: str) -> LiveCallSession:
    try:
        _, clerk_key = resolve_kb_tenant(ctx)
    except Exception:
        clerk_key = _fallback_tenant_key(ctx)
        _logger.exception(
            "tenant resolution failed for live analysis; using fallback tenant key call_id=%s tenant_key=%s",
            call_id,
            clerk_key,
        )
    session = get_live_session(clerk_key, call_id)
    try:
        _load_brief_context(ctx, call_id, session)
    except Exception:
        _logger.exception("brief context load failed for live analysis call_id=%s", call_id)
    return session


def _load_brief_context(ctx: TenantContext, call_id: str, session: LiveCallSession) -> None:
    if session.brief_context.pains or session.brief_context.account_name:
        return
    brief = CallsService().get_brief(ctx, call_id)
    call = CallsService().get_call(ctx, call_id)
    account = (call or {}).get("accountName") or ""
    if brief:
        session.brief_context = BriefContext(
            pains=list(brief.get("pains") or []),
            discovery_questions=list(brief.get("discovery_questions") or []),
            account_name=account or brief.get("accountName", ""),
        )
    else:
        session.brief_context = BriefContext(account_name=account)


def _fuzzy_pain_match(text: str, pain_text: str) -> float:
    lower = text.lower()
    p = pain_text.lower().strip()
    if not p:
        return 0.0
    if p in lower:
        return 0.95
    words = [w for w in re.findall(r"[a-z]{4,}", p) if len(w) > 3]
    if words and sum(1 for w in words if w in lower) >= max(1, len(words) // 2):
        return 0.82
    return SequenceMatcher(None, lower, p).ratio()


def _detect_pains(
    text: str,
    session: LiveCallSession,
    call_id: str,
    timestamp: float,
) -> List[Dict[str, Any]]:
    new_pains: List[Dict[str, Any]] = []
    existing_texts = {p.get("text", "").lower() for p in session.detected_pains}

    for pain in session.brief_context.pains:
        pain_text = pain.get("text") or ""
        if pain_text.lower() in existing_texts:
            continue
        if _fuzzy_pain_match(text, pain_text) >= 0.72:
            entry = {
                "id": str(uuid.uuid4()),
                "text": pain_text,
                "source": "brief_match",
                "confidence": float(pain.get("confidence", 0.8)),
                "timestamp": timestamp,
                "evidence": text[:200],
            }
            session.detected_pains.append(entry)
            new_pains.append(entry)
            existing_texts.add(pain_text.lower())

    for pattern in _PAIN_EMERGENT_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            snippet = text[:120]
            key = f"emergent:{snippet[:40]}"
            if key not in existing_texts:
                entry = {
                    "id": str(uuid.uuid4()),
                    "text": snippet,
                    "source": "emergent",
                    "confidence": 0.65,
                    "timestamp": timestamp,
                    "evidence": text[:200],
                }
                session.detected_pains.append(entry)
                new_pains.append(entry)
                existing_texts.add(key)
            break

    return new_pains


def _update_keyword_counts(
    session: LiveCallSession,
    speaker_id: str,
    terms: List[str],
) -> None:
    counts = session.keyword_counts.setdefault(speaker_id, {})
    for term in filter_salient_terms(terms):
        counts[term] = counts.get(term, 0) + 1

    global_counts: Dict[str, int] = {}
    for speaker_counts in session.keyword_counts.values():
        for term, count in speaker_counts.items():
            if not is_salient_term(term):
                continue
            global_counts[term] = global_counts.get(term, 0) + count
    session.top_keywords = sorted(
        [{"term": t, "count": c} for t, c in global_counts.items() if is_salient_term(t)],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]


def _recompute_focus_areas(session: LiveCallSession, signal_type: Optional[str]) -> None:
    areas: List[str] = []
    display = session.current_intent.get("display") or ""
    if display:
        areas.append(display)
    for kw in session.top_keywords[:3]:
        areas.append(kw["term"].replace("-", " ").title())
    if signal_type:
        signal_labels = {
            "budget_signal": "Budget",
            "timeline_signal": "Timeline",
            "competitor_mentioned": "Competition",
            "technical_question": "Technical",
            "objection_raised": "Objection",
        }
        areas.append(signal_labels.get(signal_type, signal_type.replace("_", " ").title()))
    session.focus_areas = list(dict.fromkeys(areas))[:4]


def _update_intent(session: LiveCallSession, signal_type: Optional[str], text: str, confidence: float) -> None:
    if signal_type and signal_type in _INTENT_FROM_SIGNAL:
        label = _INTENT_FROM_SIGNAL[signal_type]
        session.current_intent = {
            "label": label,
            "display": _INTENT_DISPLAY.get(label, label.replace("_", " ").title()),
            "confidence": confidence,
            "evidence": text[:160],
            "signal_type": signal_type,
        }
    elif session.top_keywords:
        top = session.top_keywords[0]["term"]
        session.current_intent = {
            "label": "topic_focus",
            "display": f"Focus: {top.replace('-', ' ').title()}",
            "confidence": 0.55,
            "evidence": f"Recurring topic: {top}",
            "signal_type": None,
        }


def _detect_sentiment_shift(
    session: LiveCallSession,
    speaker_role: str,
    score: float,
    timestamp: float,
) -> Optional[Dict[str, Any]]:
    if speaker_role == "customer":
        session.customer_recent_scores.append(score)
        session.customer_recent_scores = session.customer_recent_scores[-5:]
        if len(session.customer_recent_scores) >= 3:
            recent = session.customer_recent_scores[-3:]
            if recent[0] - recent[-1] >= 0.25:
                shift = {
                    "direction": "negative",
                    "from_score": recent[0],
                    "to_score": recent[-1],
                    "timestamp": timestamp,
                    "message": "Customer sentiment shifted toward negative — check engagement.",
                }
                session.sentiment_shift = shift
                return shift
            if recent[-1] - recent[0] >= 0.25:
                shift = {
                    "direction": "positive",
                    "from_score": recent[0],
                    "to_score": recent[-1],
                    "timestamp": timestamp,
                    "message": "Customer sentiment is warming after the latest response.",
                }
                session.sentiment_shift = shift
                return shift
    return session.sentiment_shift if session.segment_count % 1 == 0 else None


def _retrieve_kb_hits(ctx: TenantContext, query: str, limit: int = 3) -> List[Dict[str, Any]]:
    settings = get_settings()
    try:
        tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    except Exception:
        _logger.exception("tenant resolution failed for live KB retrieval")
        return []
    repo = get_kb_repository()

    def vector_search(tid: str, embedding: List[float], lim: int) -> List[Dict[str, Any]]:
        return repo.match_chunks(tenant_uuid, embedding, limit=lim, clerk_key=clerk_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    try:
        return retrieve_kb(
            tenant_uuid,
            query,
            limit=limit,
            chunks=get_memory_store().kb_chunks.get(clerk_key, []),
            embed_fn=embed_fn,
            vector_search_fn=vector_search if embed_fn else None,
        )
    except Exception:
        _logger.exception("live KB retrieval failed")
        return []


def analyze_segment(
    ctx: TenantContext,
    call_id: str,
    segment: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Cheap pass on every transcript segment. Returns WS payloads and optional nudge/suggestion.
    """
    session = _resolve_live_session(ctx, call_id)

    text = (segment.get("text") or "").strip()
    if not text:
        return {"empty": True}

    speaker_id = segment.get("speakerId") or "unknown"
    speaker_role = segment.get("speakerRole") or "customer"
    timestamp = float(segment.get("timestamp") or session.segment_count * 2)

    cfg = get_agent_config_repository().get_config(ctx, "live-call")
    routing = cfg.get("signal_routing") or []

    kw_result = extract_keywords(text, signal_routing=routing)
    sentiment = analyze_sentiment(text, speaker_role)

    session.segment_count += 1
    _update_keyword_counts(session, speaker_id, kw_result["terms"])
    _update_intent(session, kw_result.get("signal_type"), text, kw_result.get("routing_confidence", 0.0))
    _recompute_focus_areas(session, kw_result.get("signal_type"))

    series_key = "ae" if speaker_role in ("ae", "se", "designer") else "customer"
    point = {
        "timestamp": timestamp,
        "valence": sentiment["score"],
        "label": sentiment["label"],
    }
    session.sentiment_series.setdefault(series_key, []).append(point)
    session.sentiment_series[series_key] = session.sentiment_series[series_key][-120:]

    if series_key == "ae":
        session.last_ae_score = sentiment["score"]
    else:
        session.last_customer_score = sentiment["score"]

    new_pains = _detect_pains(text, session, call_id, timestamp)
    shift = _detect_sentiment_shift(session, speaker_role, sentiment["score"], timestamp)

    transcript_payload = {
        "id": segment.get("id") or str(uuid.uuid4()),
        "speakerId": speaker_id,
        "speakerName": segment.get("speakerName") or speaker_id,
        "speakerRole": speaker_role,
        "text": text,
        "timestamp": timestamp,
        "keywords": kw_result["terms"],
        "sentiment": sentiment["label"],
        "signalType": kw_result.get("signal_type"),
    }

    nudge: Optional[Dict[str, Any]] = None
    focus_suggestion: Optional[Dict[str, Any]] = None
    citations: List[Citation] = [
        Citation(
            source_type="transcript",
            source_id=call_id,
            snippet=text[:120],
            confidence=0.9,
        )
    ]

    # Routing-based proactive nudge
    if new_pains:
        pain = new_pains[0]
        focus_suggestion = {
            "message": (
                f"Customer raised: \"{pain['text'][:80]}\" — "
                f"align next questions to this pain and related capabilities."
            ),
            "pain_id": pain["id"],
        }
        nudge = {
            "id": str(uuid.uuid4()),
            "message": focus_suggestion["message"],
            "role": "ae",
            "timestamp": timestamp,
            "citation": {
                "id": str(uuid.uuid4()),
                "title": "Pain point detected",
                "type": "transcript",
                "excerpt": pain.get("evidence", text[:200]),
            },
        }

    if not nudge and kw_result.get("signal_type") and kw_result.get("routing_confidence", 0) >= 0.65:
        target = "ae"
        for rule in routing:
            if rule.get("id") == kw_result.get("matched_rule_id"):
                tr = (rule.get("target_role") or "AE").lower()
                if tr == "se":
                    target = "se"
                elif tr == "designer":
                    target = "designer"
                break
        intent_label = session.current_intent.get("label", "discovery")
        focus = ", ".join(session.focus_areas[:2]) or "this topic"
        nudge = {
            "id": str(uuid.uuid4()),
            "message": (
                f"[{intent_label.replace('_', ' ')}] Prospect signal detected — "
                f"emphasize {focus}. Surface a relevant asset or discovery question."
            ),
            "role": target,
            "timestamp": timestamp,
            "citation": {
                "id": str(uuid.uuid4()),
                "title": "Live transcript",
                "type": "transcript",
                "excerpt": text[:200],
            },
        }

    # Sentiment shift alert nudge
    if shift and shift.get("direction") == "negative" and not nudge:
        nudge = {
            "id": str(uuid.uuid4()),
            "message": shift["message"],
            "role": "ae",
            "timestamp": timestamp,
            "citation": {
                "id": str(uuid.uuid4()),
                "title": "Sentiment shift",
                "type": "transcript",
                "excerpt": text[:200],
            },
        }

    # KB capability suggestion on topic spike
    topic_key = kw_result["terms"][0] if kw_result["terms"] else None
    if topic_key:
        session.topic_spike_counts[topic_key] = session.topic_spike_counts.get(topic_key, 0) + 1
        if (
            session.topic_spike_counts[topic_key] >= _TOPIC_SPIKE_THRESHOLD
            and topic_key not in session.kb_suggestions_emitted
        ):
            hits = _retrieve_kb_hits(ctx, topic_key + " " + text[:80])
            if hits:
                hit = hits[0]
                session.kb_suggestions_emitted.add(topic_key)
                excerpt = (hit.get("chunk_text") or "")[:200]
                asset_id = str(hit.get("asset_id", "kb"))
                citations.append(
                    Citation(
                        source_type="kb_document",
                        source_id=asset_id,
                        snippet=excerpt,
                        confidence=float(hit.get("score", 0.75)),
                    )
                )
                if not nudge:
                    nudge = {
                        "id": str(uuid.uuid4()),
                        "message": (
                            f"Team focus: \"{topic_key}\" — customer keeps mentioning this. "
                            f"Next: reference capability from KB ({asset_id})."
                        ),
                        "role": "ae",
                        "timestamp": timestamp,
                        "citation": {
                            "id": str(uuid.uuid4()),
                            "title": "Knowledge base",
                            "type": "case-study",
                            "excerpt": excerpt,
                        },
                    }

    intent_payload = {
        "intent": session.current_intent,
        "focus_areas": session.focus_areas,
        "pains": session.detected_pains[-10:],
        "top_keywords": session.top_keywords,
        "next_actions": [],
    }

    return {
        "transcript": transcript_payload,
        "intent_update": intent_payload,
        "keyword_stats": session.keyword_stats_payload(),
        "sentiment": {
            "ae": session.last_ae_score,
            "customer": session.last_customer_score,
            "shift": shift,
        },
        "nudge": nudge,
        "citations": citations,
        "operation": "proactive_nudge" if nudge else "intent_snapshot",
    }
