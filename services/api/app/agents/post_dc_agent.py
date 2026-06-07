from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient

from app.agents.relevant_content import filter_library_kb_hits
from app.config import get_settings
from app.domain.agent_config_repository import get_agent_config_repository
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.memory_store import get_memory_store
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

PROMPTS_ROOT = Path(__file__).resolve().parents[4] / "prompts"

BANT_LABELS = {
    "budget": "Budget",
    "authority": "Authority",
    "need": "Need",
    "timeline": "Timeline",
    "next_step": "Next step",
}

TRANSCRIPT_DIGEST_LIMIT = 220
TRANSCRIPT_DIGEST_HEAD = 40
TRANSCRIPT_EXCERPT_LIMIT = 12
LIVE_SUGGESTION_LIMIT = 80


def load_prompt(rel_path: str) -> str:
    path = PROMPTS_ROOT / rel_path
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def resolve_prompt(cfg: Dict[str, Any], operation: str, default_path: str) -> str:
    overrides = cfg.get("post_dc_prompts") or {}
    custom = (overrides.get(operation) or "").strip()
    if custom:
        return custom
    file_text = load_prompt(default_path)
    return file_text or f"You are the Post-DC Agent ({operation})."


def _extract_json_block(text: str) -> Optional[Dict[str, Any]]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _snapshot_result(snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not snapshot:
        return {}
    result = snapshot.get("result")
    return result if isinstance(result, dict) else snapshot


def _open_gaps(discovery_snapshot: Optional[Dict[str, Any]]) -> List[str]:
    result = _snapshot_result(discovery_snapshot)
    gaps = result.get("openGaps") or []
    return [str(g) for g in gaps if str(g).strip()]


def _bant_coverage(discovery_snapshot: Optional[Dict[str, Any]]) -> Optional[float]:
    result = _snapshot_result(discovery_snapshot)
    checklist = result.get("checklist") if isinstance(result.get("checklist"), dict) else {}
    value = checklist.get("bantCoverage") if checklist else result.get("bantCoverage")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _bant_progression(discovery_snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    result = _snapshot_result(discovery_snapshot)
    progression = result.get("bantProgression")
    return progression if isinstance(progression, dict) else {}


def _evidence_matches_dimension(dim: str, value: str) -> bool:
    text = value.lower()
    if dim == "budget":
        return bool(
            re.search(
                r"(\$|€|£|\b(?:budget|approved|investment|price|pricing|spend|commercial)\b|"
                r"\b\d[\d,]*(?:\.\d+)?\s*[kmb]\b|\b\d+\s*-\s*\d+\s*[kmb]\b)",
                text,
            )
        )
    if dim == "authority":
        return bool(re.search(r"\b(authority|decision|decider|approve|approval|owner|owns|cfo|ceo|president)\b", text))
    if dim == "need":
        return bool(re.search(r"\b(need|priority|pain|challenge|problem|replace|custom|erp|workflow|manual|causing)\b", text))
    if dim == "timeline":
        return bool(re.search(r"\b(timeline|deadline|days|weeks|months|quarter|q[1-4]|go-live|launch|by)\b", text))
    return True


def _bant_evidence(discovery_snapshot: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    result = _snapshot_result(discovery_snapshot)
    checklist = result.get("checklist") if isinstance(result.get("checklist"), dict) else {}
    items = checklist.get("items") if isinstance(checklist.get("items"), list) else []
    bant = checklist.get("bant") if isinstance(checklist.get("bant"), dict) else {}
    out: Dict[str, Dict[str, str]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id") or "")
        if item_id not in ("budget", "authority", "need", "timeline"):
            continue
        evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
        latest: Dict[str, Any] = {}
        fallback: Dict[str, Any] = {}
        for candidate in reversed(evidence):
            if not isinstance(candidate, dict):
                continue
            candidate_text = str(candidate.get("value") or candidate.get("snippet") or "").strip()
            if not candidate_text:
                continue
            if not fallback:
                fallback = candidate
            if _evidence_matches_dimension(item_id, candidate_text):
                latest = candidate
                break
        if not latest:
            latest = fallback
        raw_value = str(latest.get("value") or latest.get("snippet") or "").strip()
        if item_id == "budget":
            budget_range = re.search(
                r"\b\d[\d,]*(?:\.\d+)?\s*-\s*\d[\d,]*(?:\.\d+)?\s*[kmb]\b",
                " ".join(
                    [
                        str(latest.get("value") or ""),
                        str(latest.get("snippet") or ""),
                    ]
                ),
                re.I,
            )
            if budget_range:
                raw_value = re.sub(r"\s+", "", budget_range.group(0))
        value = re.sub(
            r"\s+",
            " ",
            raw_value,
        )
        if not value:
            continue
        out[item_id] = {
            "label": BANT_LABELS.get(item_id, item_id.title()),
            "status": str(item.get("status") or bant.get(item_id) or ""),
            "value": value[:220],
            "snippet": re.sub(r"\s+", " ", str(latest.get("snippet") or "").strip())[:220],
        }
    return out


def _bant_discussion_line(evidence: Dict[str, Dict[str, str]]) -> str:
    parts: List[str] = []
    for dim in ("budget", "authority", "need", "timeline"):
        item = evidence.get(dim)
        if not item:
            continue
        value = item.get("value") or item.get("snippet")
        if value:
            parts.append(f"{BANT_LABELS[dim]}: {value}")
    return "; ".join(parts)


def _post_field(post_dc_record: Optional[Dict[str, Any]], key: str) -> str:
    fields = (post_dc_record or {}).get("fields") or {}
    return str(fields.get(key) or "").strip()


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _account_name(call: Optional[Dict[str, Any]], pre_dc_fields: Optional[Dict[str, str]], call_id: str) -> str:
    return _first_text(
        (call or {}).get("accountName"),
        (pre_dc_fields or {}).get("Company Name-PreDC"),
        call_id,
    )


def _extract_recipients(call: Optional[Dict[str, Any]], pre_dc_fields: Optional[Dict[str, str]]) -> List[str]:
    candidates = [
        (call or {}).get("leadEmail"),
        (call or {}).get("email"),
        (pre_dc_fields or {}).get("Lead Email-PreDC"),
        (pre_dc_fields or {}).get("Lead Email"),
        (pre_dc_fields or {}).get("Email-PreDC"),
        (pre_dc_fields or {}).get("Email"),
        (pre_dc_fields or {}).get("Contact Email"),
    ]
    out: List[str] = []
    for candidate in candidates:
        for piece in re.split(r"[,;]", str(candidate or "")):
            email = piece.strip()
            if email and "@" in email and email not in out:
                out.append(email)
    return out


def _format_transcript_event(event: Dict[str, Any]) -> Optional[str]:
    text = str(event.get("text") or "").strip()
    if not text:
        return None
    speaker = str(
        event.get("speaker_name")
        or event.get("speakerName")
        or event.get("speaker_id")
        or event.get("speakerRole")
        or event.get("speaker_role")
        or "Speaker"
    )
    try:
        offset = int(float(event.get("offset_seconds") or event.get("timestamp") or 0))
    except (TypeError, ValueError):
        offset = 0
    prefix = f"{speaker} @{offset}s" if offset else speaker
    return f"{prefix}: {text}"


def _transcript_tail(transcript_events: Optional[List[Dict[str, Any]]], *, limit: int) -> str:
    events = transcript_events or []
    lines: List[str] = []
    for event in events[-limit:]:
        line = _format_transcript_event(event)
        if line:
            lines.append(line)
    return "\n".join(lines)


def _transcript_excerpt(transcript_events: Optional[List[Dict[str, Any]]]) -> str:
    return _transcript_tail(transcript_events, limit=TRANSCRIPT_EXCERPT_LIMIT)


def _transcript_full_text(transcript_events: Optional[List[Dict[str, Any]]]) -> str:
    events = transcript_events or []
    return "\n".join(line for event in events if (line := _format_transcript_event(event)))


def _transcript_digest(transcript_events: Optional[List[Dict[str, Any]]]) -> str:
    events = transcript_events or []
    if len(events) <= TRANSCRIPT_DIGEST_LIMIT:
        selected: List[Dict[str, Any]] = events
    else:
        tail_count = max(TRANSCRIPT_DIGEST_LIMIT - TRANSCRIPT_DIGEST_HEAD, 1)
        selected = events[:TRANSCRIPT_DIGEST_HEAD]
        omitted = len(events) - TRANSCRIPT_DIGEST_HEAD - tail_count
        if omitted > 0:
            selected.append({"text": f"[{omitted} transcript segments omitted from compact digest]"})
        selected.extend(events[-tail_count:])
    return "\n".join(line for event in selected if (line := _format_transcript_event(event)))


def _transcript_event_payload(transcript_events: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    events = transcript_events or []
    if len(events) <= TRANSCRIPT_DIGEST_LIMIT:
        selected = events
    else:
        tail_count = max(TRANSCRIPT_DIGEST_LIMIT - TRANSCRIPT_DIGEST_HEAD, 1)
        selected = events[:TRANSCRIPT_DIGEST_HEAD] + events[-tail_count:]
    payload: List[Dict[str, Any]] = []
    for event in selected:
        text = str(event.get("text") or "").strip()
        if not text:
            continue
        payload.append(
            {
                "speaker": event.get("speaker_name") or event.get("speakerName") or event.get("speaker_id"),
                "role": event.get("speaker_role") or event.get("speakerRole"),
                "offset_seconds": event.get("offset_seconds") or event.get("timestamp"),
                "text": text[:800],
                "keywords": event.get("keywords") or [],
            }
        )
    return payload


def _normalize_pod_role(role: Any, speaker: Any = "") -> str:
    text = f"{role or ''} {speaker or ''}".lower()
    if "designer" in text or "ux" in text:
        return "designer"
    if "se" in text or "solution" in text or "solutions engineer" in text:
        return "se"
    if "ae" in text or "account executive" in text or "sales" in text:
        return "ae"
    if "pod" in text:
        return "pod"
    return ""


def _role_short(role: str) -> str:
    return {"ae": "AE", "se": "SE", "designer": "Designer", "pod": "Pod"}.get(role, role or "Pod")


def _role_in_call(role: str) -> str:
    return {
        "ae": "Account Executive",
        "se": "Solutions Engineer",
        "designer": "Designer",
        "pod": "Pod",
    }.get(role, _role_short(role))


def _format_talk_time(seconds: int) -> str:
    seconds = max(0, int(seconds))
    minutes, remaining = divmod(seconds, 60)
    return f"{minutes}m {remaining}s" if minutes else f"{remaining}s"


def _event_talk_seconds(event: Dict[str, Any], text: str) -> int:
    for key in ("duration_seconds", "durationSeconds", "talk_time_seconds", "talkTimeSeconds"):
        try:
            value = float(event.get(key))
        except (TypeError, ValueError):
            continue
        if value > 0:
            return max(1, int(round(value)))
    words = re.findall(r"\w+", text)
    return max(2, int(round(len(words) / 2.6))) if words else 0


def _pod_talk_time(transcript_events: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    by_speaker: Dict[str, Dict[str, Any]] = {}
    for event in transcript_events or []:
        text = str(event.get("text") or "").strip()
        if not text:
            continue
        speaker = str(
            event.get("speaker_name")
            or event.get("speakerName")
            or event.get("speaker_id")
            or event.get("speakerId")
            or ""
        ).strip()
        role = _normalize_pod_role(event.get("speaker_role") or event.get("speakerRole"), speaker)
        if role not in ("ae", "se", "designer"):
            continue
        name = speaker or _role_short(role)
        key = re.sub(r"\s+", " ", name).strip().lower()
        row = by_speaker.setdefault(
            key,
            {
                "member": name,
                "role": _role_short(role),
                "roleInCall": _role_in_call(role),
                "talkTimeSeconds": 0,
                "eventCount": 0,
            },
        )
        row["talkTimeSeconds"] += _event_talk_seconds(event, text)
        row["eventCount"] += 1
    out = list(by_speaker.values())
    for row in out:
        row["talkTimeLabel"] = _format_talk_time(row["talkTimeSeconds"])
    return sorted(out, key=lambda row: row.get("talkTimeSeconds", 0), reverse=True)


def _match_talk_time(row: Dict[str, Any], talk_time: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not talk_time:
        return None
    member = str(row.get("member") or "").lower()
    role = _normalize_pod_role(row.get("role") or row.get("roleInCall"), member)
    if member == "pod" or role == "pod":
        seconds = sum(int(item.get("talkTimeSeconds") or 0) for item in talk_time)
        return {
            "member": "Pod",
            "role": "Pod",
            "roleInCall": "Pod",
            "talkTimeSeconds": seconds,
            "talkTimeLabel": _format_talk_time(seconds),
        }
    for item in talk_time:
        item_member = str(item.get("member") or "").lower()
        if item_member and (item_member in member or member in item_member):
            return item
    role_matches = [
        item
        for item in talk_time
        if _normalize_pod_role(item.get("role") or item.get("roleInCall")) == role and role
    ]
    if len(role_matches) == 1:
        return role_matches[0]
    return None


def _normalize_scorecard_rows(
    scorecard: List[Dict[str, Any]],
    talk_time: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in scorecard:
        if not isinstance(item, dict):
            continue
        row = dict(item)
        matched = _match_talk_time(row, talk_time)
        role = _normalize_pod_role(row.get("role") or row.get("roleInCall"), row.get("member"))
        if matched:
            row.setdefault("member", matched.get("member"))
            row.setdefault("role", matched.get("role"))
            row["roleInCall"] = row.get("roleInCall") or matched.get("roleInCall")
            row["talkTimeSeconds"] = matched.get("talkTimeSeconds")
            row["talkTimeLabel"] = matched.get("talkTimeLabel")
        else:
            row["roleInCall"] = row.get("roleInCall") or _role_in_call(role or "pod")
        try:
            row["score"] = max(0.0, min(1.0, float(row.get("score", 0.7))))
        except (TypeError, ValueError):
            row["score"] = 0.7
        row["label"] = str(row.get("label") or ("strong" if row["score"] >= 0.8 else "review"))
        watch = str(row.get("watch") or "").strip()
        areas = row.get("areasToWork")
        if isinstance(areas, list):
            clean_areas = [str(area).strip() for area in areas if str(area).strip()]
        else:
            clean_areas = []
        if not clean_areas and watch:
            clean_areas = [watch]
        row["areasToWork"] = clean_areas
        row["strengths"] = str(row.get("strengths") or "Review the transcript for this member's strongest contribution.")
        row["watch"] = watch or (clean_areas[0] if clean_areas else "")
        rows.append(row)
    return rows


def _truncate_context_value(value: Any, *, max_string: int = 1200) -> Any:
    if isinstance(value, str):
        return value if len(value) <= max_string else value[: max_string - 3] + "..."
    if isinstance(value, list):
        return [_truncate_context_value(item, max_string=max_string) for item in value]
    if isinstance(value, dict):
        return {str(k): _truncate_context_value(v, max_string=max_string) for k, v in value.items()}
    return value


def _live_suggestions_context(live_suggestions: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    suggestions = live_suggestions or []
    out: List[Dict[str, Any]] = []
    for item in suggestions[-LIVE_SUGGESTION_LIMIT:]:
        payload = item.get("payload") if isinstance(item.get("payload"), dict) else {}
        out.append(
            {
                "operation": item.get("operation"),
                "target_role": item.get("target_role"),
                "status": item.get("status"),
                "confidence": item.get("confidence"),
                "offset_seconds": item.get("transcript_offset_seconds"),
                "trace_id": item.get("trace_id"),
                "payload": _truncate_context_value(payload),
            }
        )
    return out


def _agent_input_summary(
    *,
    transcript_events: Optional[List[Dict[str, Any]]],
    live_snapshot: Optional[Dict[str, Any]],
    live_suggestions: Optional[List[Dict[str, Any]]],
    discovery_snapshot: Optional[Dict[str, Any]],
    call_agent_handoff: Optional[Dict[str, Any]] = None,
    source_record_count: int = 0,
    kb_hit_count: int = 0,
) -> Dict[str, Any]:
    discovery = _snapshot_result(discovery_snapshot)
    return {
        "sources": [
            {
                "name": "live_call_agent_handoff",
                "description": "Canonical call-end output: transcript, transcript summary, defined signals, BANT, sentiment, and live summary.",
                "count": 1 if call_agent_handoff else 0,
            },
            {
                "name": "call_transcript_events",
                "description": "Speaker-attributed transcript captured during the live call.",
                "count": len(transcript_events or []),
            },
            {
                "name": "live_call_agent_outputs",
                "description": "Intent, focus areas, keyword stats, sentiment, nudges, and KB surfaces from the live call agent.",
                "count": len(live_suggestions or []),
            },
            {
                "name": "discovery_checklist",
                "description": "BANT coverage, progression, and open discovery gaps from the live checklist agent.",
                "count": 1 if discovery else 0,
            },
            {
                "name": "pre_dc_and_post_dc_records",
                "description": "Pre-DC/Post-DC source fields, call brief, and any matched notes already imported for the account.",
                "count": source_record_count,
            },
            {
                "name": "knowledge_base_hits",
                "description": "Relevant KB assets retrieved for follow-up proof points and attachment suggestions.",
                "count": kb_hit_count,
            },
        ],
        "transcriptEventCount": len(transcript_events or []),
        "transcriptDigestLimit": TRANSCRIPT_DIGEST_LIMIT,
        "liveSuggestionCount": len(live_suggestions or []),
        "hasLiveSignalSnapshot": bool(live_snapshot),
        "hasDiscoverySnapshot": bool(discovery),
        "hasCallAgentHandoff": bool(call_agent_handoff),
        "callAgentHandoffSections": list((call_agent_handoff or {}).keys()),
    }


def _commitments_from_text(text: str) -> List[str]:
    commitments: List[str] = []
    for raw in re.split(r"(?<=[.!?])\s+", text):
        sentence = raw.strip()
        if not sentence:
            continue
        lower = sentence.lower()
        if any(token in lower for token in ("follow up", "send", "share", "schedule", "circle back", "next step")):
            cleaned = sentence[:220]
            if cleaned not in commitments:
                commitments.append(cleaned)
    return commitments[:5]


def _commitments(
    transcript_events: Optional[List[Dict[str, Any]]],
    live_snapshot: Optional[Dict[str, Any]],
    summary_json: Optional[Dict[str, Any]] = None,
) -> List[str]:
    from_llm = (summary_json or {}).get("commitments") or []
    commitments = [str(c).strip() for c in from_llm if str(c).strip()]
    text = _transcript_full_text(transcript_events)
    commitments.extend(_commitments_from_text(text))
    focus = (live_snapshot or {}).get("focus_areas") or []
    for item in focus:
        label = str(item).strip()
        if label:
            commitments.append(f"Follow up on {label}.")
    seen: List[str] = []
    for item in commitments:
        if item and item not in seen:
            seen.append(item)
    return seen[:5]


ASSET_TERMS = {
    "architecture": ("Technical architecture", "architecture"),
    "reference architecture": ("Reference architecture", "architecture"),
    "case study": ("Case study", "case_study"),
    "deck": ("Follow-up deck", "deck"),
    "proposal": ("Proposal", "deck"),
    "one-pager": ("One-pager", "one_pager"),
    "one pager": ("One-pager", "one_pager"),
    "roi": ("ROI one-pager", "one_pager"),
    "security": ("Security overview", "one_pager"),
    "sow": ("Pilot SOW", "one_pager"),
    "scope": ("Scope summary", "one_pager"),
    "timeline": ("Implementation timeline", "one_pager"),
    "implementation plan": ("Implementation plan", "one_pager"),
    "integration": ("Integration details", "architecture"),
    "pricing": ("Pricing summary", "one_pager"),
    "business case": ("Business case", "one_pager"),
    "readout": ("Executive readout", "deck"),
    "demo": ("Demo plan", "demo_script"),
}

NEED_PATTERNS = re.compile(
    r"\b(need|needs|needed|looking for|want|wants|require|requires|must|goal|"
    r"challenge|problem|pain|priority|deadline|launch|integrat|automate|visibility|"
    r"compliance|audit|security|roi|approval|decision|cfo|board)\b",
    re.I,
)
REQUEST_PATTERNS = re.compile(
    r"\b(send|share|attach|provide|include|create|prepare|need|want|can you|could you|"
    r"would like|we'd like|please)\b",
    re.I,
)
NEXT_STEP_PATTERNS = re.compile(
    r"\b(next step|follow up|schedule|meeting|workshop|review|readout|proposal|"
    r"before|after|timeline|deadline|circle back)\b",
    re.I,
)
OBJECTION_PATTERNS = re.compile(
    r"\b(concern|worried|risk|blocker|expensive|budget|security|legal|procurement|"
    r"not sure|hesitant|challenge)\b",
    re.I,
)


def _transcript_sentences(transcript_events: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for event in transcript_events or []:
        text = str(event.get("text") or "").strip()
        if not text:
            continue
        speaker = str(event.get("speaker_name") or event.get("speakerName") or event.get("speaker_id") or "Speaker")
        role = str(event.get("speaker_role") or event.get("speakerRole") or "").lower()
        try:
            offset = int(float(event.get("offset_seconds") or event.get("timestamp") or 0))
        except (TypeError, ValueError):
            offset = 0
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", text) if p.strip()]
        for part in parts or [text]:
            rows.append({"speaker": speaker, "role": role, "offset_seconds": offset, "text": part[:420]})
    return rows


def _dedupe_context_items(items: List[Dict[str, Any]], *, key: str = "text", limit: int = 8) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for item in items:
        value = re.sub(r"\s+", " ", str(item.get(key) or item.get("name") or "")).strip().lower()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def _asset_requests_from_sentence(sentence: Dict[str, Any]) -> List[Dict[str, Any]]:
    text = str(sentence.get("text") or "").strip()
    lower = text.lower()
    if not REQUEST_PATTERNS.search(text):
        return []
    matches: List[Tuple[str, str, str]] = []
    for term, (label, artifact_type) in ASSET_TERMS.items():
        if term in lower:
            matches.append((term, label, artifact_type))
    if not matches:
        return []
    labels: List[Tuple[str, str]] = []
    if "cfo" in lower and "roi" in lower:
        labels.append(("CFO ROI one-pager", "one_pager"))
    if "security" in lower and "architecture" in lower:
        labels.append(("Security architecture overview", "architecture"))
    if "integration" in lower and "detail" in lower:
        labels.append(("Integration details", "architecture"))
    for _, label, artifact_type in sorted(matches, key=lambda row: len(row[0]), reverse=True):
        labels.append((label, artifact_type))
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for label, artifact_type in labels:
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "name": label,
                "type": artifact_type,
                "evidence": text,
                "speaker": sentence.get("speaker"),
                "offset_seconds": sentence.get("offset_seconds"),
                "requiredData": f"Create or find: {label}. Transcript evidence: {text}",
            }
        )
    return out[:4]


def _conversation_context(
    transcript_events: Optional[List[Dict[str, Any]]],
    live_snapshot: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    sentences = _transcript_sentences(transcript_events)
    needs: List[Dict[str, Any]] = []
    next_steps: List[Dict[str, Any]] = []
    objections: List[Dict[str, Any]] = []
    requested_assets: List[Dict[str, Any]] = []
    for sentence in sentences:
        text = str(sentence.get("text") or "")
        role = str(sentence.get("role") or "")
        buyer_like = role in ("customer", "prospect", "buyer", "") or "buyer" in str(sentence.get("speaker") or "").lower()
        if buyer_like and NEED_PATTERNS.search(text):
            needs.append(sentence)
        if NEXT_STEP_PATTERNS.search(text):
            next_steps.append(sentence)
        if buyer_like and OBJECTION_PATTERNS.search(text):
            objections.append(sentence)
        requested_assets.extend(_asset_requests_from_sentence(sentence))

    focus_areas = [str(item) for item in (live_snapshot or {}).get("focus_areas") or [] if str(item).strip()]
    top_keywords = [
        str(item.get("term"))
        for item in ((live_snapshot or {}).get("top_keywords") or [])
        if isinstance(item, dict) and str(item.get("term") or "").strip()
    ]
    return {
        "needs": _dedupe_context_items(needs, limit=8),
        "requestedAssets": _dedupe_context_items(requested_assets, key="name", limit=8),
        "nextSteps": _dedupe_context_items(next_steps, limit=8),
        "objectionsOrRisks": _dedupe_context_items(objections, limit=6),
        "focusAreas": focus_areas[:6],
        "topKeywords": top_keywords[:10],
    }


def _kb_search(ctx: TenantContext, query: str, limit: int = 4) -> Tuple[List[Dict[str, Any]], str]:
    settings = get_settings()
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    memory_key = clerk_key

    def vector_search(tid: str, embedding: List[float], lim: int) -> List[Dict[str, Any]]:
        raw = repo.match_chunks(
            tenant_uuid,
            embedding,
            limit=max(lim * 6, lim + 30),
            clerk_key=memory_key,
        )
        return filter_library_kb_hits(raw)[:lim]

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=filter_library_kb_hits(get_memory_store().kb_chunks.get(memory_key, [])),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )
    return filter_library_kb_hits(hits), memory_key


def _summary_fallback(
    account_name: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]],
    live_snapshot: Optional[Dict[str, Any]],
    pre_dc_fields: Optional[Dict[str, str]],
    post_dc_record: Optional[Dict[str, Any]],
    conversation_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    gaps = _open_gaps(discovery_snapshot)
    coverage = _bant_coverage(discovery_snapshot)
    progression = _bant_progression(discovery_snapshot)
    is_qualifying = bool(progression.get("isQualifying"))
    intent = (live_snapshot or {}).get("intent") or {}
    focus_areas = (live_snapshot or {}).get("focus_areas") or []
    needs = _first_text(
        (pre_dc_fields or {}).get("Have they described their needs"),
        _post_field(post_dc_record, "Need"),
        (pre_dc_fields or {}).get("Intersection areas b/w tkxel & company"),
    )
    lead_stage = _post_field(post_dc_record, "Lead Stage")
    bottom_line = _post_field(post_dc_record, "Bottom Line Context")
    transcript_needs = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("needs", [])
        if str(item.get("text") or "").strip()
    ]
    next_steps = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("nextSteps", [])
        if str(item.get("text") or "").strip()
    ]
    requested_assets = [
        str(item.get("name") or "").strip()
        for item in (conversation_context or {}).get("requestedAssets", [])
        if str(item.get("name") or "").strip()
    ]
    evidence = _bant_evidence(discovery_snapshot)
    evidence_line = _bant_discussion_line(evidence)

    if is_qualifying:
        headline = f"{account_name} looks qualified for a structured follow-up."
    elif gaps:
        headline = f"{account_name} needs follow-up on {', '.join(BANT_LABELS.get(g, g) for g in gaps[:2])}."
    else:
        headline = f"{account_name} post-call review is ready."

    primary_summary = ""
    if transcript_needs:
        primary_summary = f"{account_name} discussed this call need: {transcript_needs[0]}"
        if evidence_line:
            primary_summary = f"{primary_summary} BANT evidence captured {evidence_line}."
    if not primary_summary and evidence_line:
        primary_summary = f"Live call covered {evidence_line}."

    summary = [
        primary_summary
        or bottom_line
        or needs
        or f"The call centered on discovery for {account_name}.",
        f"BANT coverage finished at {round((coverage or 0) * 100)}%."
        if coverage is not None
        else "BANT coverage was captured from the discovery checklist.",
    ]
    if evidence_line and not primary_summary.startswith("Live call covered "):
        summary.append("Discussion details: " + evidence_line + ".")
    if transcript_needs:
        summary.append("Transcript needs: " + " ".join(transcript_needs[:2]))
    if next_steps:
        summary.append("Next steps discussed: " + " ".join(next_steps[:2]))
    if requested_assets:
        summary.append("Requested follow-up materials: " + ", ".join(requested_assets[:4]) + ".")
    if lead_stage:
        summary.append(f"Post-DC lead stage: {lead_stage}.")
    if intent.get("label"):
        summary.append(f"Dominant live-call intent: {intent.get('label')}.")
    if focus_areas:
        summary.append("Focus areas: " + ", ".join(str(f) for f in focus_areas[:3]) + ".")
    if gaps:
        summary.append("Open discovery gaps: " + ", ".join(BANT_LABELS.get(g, g) for g in gaps) + ".")

    if requested_assets and next_steps:
        next_step_proposal = (
            "Send the requested materials and schedule the discussed follow-up with the right stakeholders."
        )
    elif next_steps:
        next_step_proposal = "Schedule the discussed follow-up with the right stakeholders."
    elif requested_assets:
        next_step_proposal = (
            "Send the requested materials and schedule a focused follow-up with decision stakeholders."
        )
    elif is_qualifying:
        next_step_proposal = "Schedule a focused follow-up with decision stakeholders."
    else:
        next_step_proposal = "Clarify the remaining discovery gaps before advancing the deal."

    return {
        "headline": headline,
        "summary": summary[:7],
        "commitments": [],
        "nextStepProposal": next_step_proposal,
    }


def _merge_summary_with_completed_call_evidence(
    summary_json: Dict[str, Any],
    fallback_summary: Dict[str, Any],
) -> Dict[str, Any]:
    merged = dict(summary_json)
    existing = [
        str(item).strip()
        for item in (summary_json.get("summary") if isinstance(summary_json.get("summary"), list) else [])
        if str(item).strip()
    ]
    existing_markers = {line.split(":", 1)[0].strip().lower() for line in existing if ":" in line}
    for item in fallback_summary.get("summary") or []:
        text = str(item or "").strip()
        if not text:
            continue
        marker = text.split(":", 1)[0].strip().lower() if ":" in text else ""
        should_keep = marker in {
            "discussion details",
            "transcript needs",
            "next steps discussed",
            "requested follow-up materials",
            "dominant live-call intent",
            "focus areas",
            "open discovery gaps",
        }
        if should_keep and marker not in existing_markers:
            existing.append(text)
            existing_markers.add(marker)
    if not existing:
        existing = [
            str(item).strip()
            for item in fallback_summary.get("summary") or []
            if str(item).strip()
        ]
    merged["summary"] = existing[:7]
    merged["headline"] = str(merged.get("headline") or fallback_summary.get("headline") or "").strip()
    merged["nextStepProposal"] = str(
        merged.get("nextStepProposal") or fallback_summary.get("nextStepProposal") or ""
    ).strip()
    return merged


def _learned(discovery_snapshot: Optional[Dict[str, Any]], post_dc_record: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    progression = _bant_progression(discovery_snapshot)
    before = progression.get("before") if isinstance(progression.get("before"), dict) else {}
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    evidence = _bant_evidence(discovery_snapshot)
    out: List[Dict[str, Any]] = []
    for dim in ("budget", "authority", "need", "timeline"):
        label = BANT_LABELS[dim]
        post_note = _post_field(post_dc_record, label)
        before_status = before.get(dim)
        after_status = after.get(dim)
        evidence_value = (evidence.get(dim) or {}).get("value")
        if before_status or after_status:
            note = f"{label} moved from {before_status or 'unknown'} to {after_status or 'unknown'}."
            if evidence_value:
                note = f"{note} Evidence: {evidence_value}"
            if post_note:
                note = f"{note} Post-DC note: {post_note}"
            out.append({"label": label, "note": note})
        elif post_note:
            out.append({"label": label, "note": post_note})
    return out


def _bant_status_label(status: str) -> str:
    normalized = str(status or "").strip().lower()
    if normalized == "confirmed":
        return "Confirmed"
    if normalized == "partial":
        return "Partial"
    return "Not captured"


def _first_known_bant_status(*values: Any) -> str:
    for value in values:
        status = str(value or "").strip().lower()
        if status and status != "unknown":
            return status
    return "unknown"


def _transcript_bant_evidence(transcript_events: Optional[List[Dict[str, Any]]]) -> Dict[str, Dict[str, str]]:
    out: Dict[str, Dict[str, str]] = {}
    for sentence in _transcript_sentences(transcript_events):
        text = re.sub(r"\s+", " ", str(sentence.get("text") or "")).strip()
        if not text:
            continue
        for dim in ("budget", "authority", "need", "timeline"):
            if not _evidence_matches_dimension(dim, text):
                continue
            if dim == "budget":
                has_amount = bool(_money_values(text))
                existing_has_amount = bool(_money_values((out.get(dim) or {}).get("value", "")))
                if out.get(dim) and (existing_has_amount or not has_amount):
                    continue
            elif out.get(dim):
                continue
            out[dim] = {
                "label": BANT_LABELS[dim],
                "status": "confirmed",
                "value": text[:220],
            }
    return out


def _bant_score(
    discovery_snapshot: Optional[Dict[str, Any]],
    post_dc_record: Optional[Dict[str, Any]],
    transcript_events: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Dict[str, str]]:
    progression = _bant_progression(discovery_snapshot)
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    evidence = _bant_evidence(discovery_snapshot)
    transcript_evidence = _transcript_bant_evidence(transcript_events)
    out: Dict[str, Dict[str, str]] = {}
    for dim in ("budget", "authority", "need", "timeline"):
        label = BANT_LABELS[dim]
        evidence_item = evidence.get(dim) or {}
        transcript_item = transcript_evidence.get(dim) or {}
        post_note = _post_field(post_dc_record, label)
        if dim in ("authority", "need"):
            status = _first_known_bant_status(transcript_item.get("status"), after.get(dim), evidence_item.get("status"))
        else:
            status = _first_known_bant_status(after.get(dim), evidence_item.get("status"), transcript_item.get("status"))
        if dim in ("authority", "need"):
            value = _first_text(
                transcript_item.get("value"),
                evidence_item.get("value"),
                evidence_item.get("snippet"),
                post_note,
            )
        else:
            value = _first_text(
                evidence_item.get("value"),
                evidence_item.get("snippet"),
                post_note,
                transcript_item.get("value"),
            )
        if status == "unknown" and not value:
            continue
        out[dim] = {
            "label": label,
            "status": status,
            "statusLabel": _bant_status_label(status),
        }
        if value:
            out[dim]["value"] = value[:220]
    return out


def _scorecard_fallback(
    discovery_snapshot: Optional[Dict[str, Any]],
    live_snapshot: Optional[Dict[str, Any]],
    pod_talk_time: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    gaps = _open_gaps(discovery_snapshot)
    coverage = _bant_coverage(discovery_snapshot)
    customer_sentiment = (live_snapshot or {}).get("sentiment_customer")
    score = 0.7
    if coverage is not None:
        score = max(0.55, min(0.92, 0.55 + coverage * 0.35))
    if isinstance(customer_sentiment, (int, float)) and customer_sentiment > 0.25:
        score = min(0.95, score + 0.05)
    label = "strong" if score >= 0.8 else "review" if score >= 0.7 else "needs follow-up"
    watch = "Clarify remaining gaps: " + ", ".join(BANT_LABELS.get(g, g) for g in gaps) + "." if gaps else "Confirm next-step ownership."
    if pod_talk_time:
        rows: List[Dict[str, Any]] = []
        for item in pod_talk_time:
            role = _normalize_pod_role(item.get("role") or item.get("roleInCall"), item.get("member"))
            rows.append(
                {
                    "member": item.get("member") or _role_short(role),
                    "role": item.get("role") or _role_short(role),
                    "roleInCall": item.get("roleInCall") or _role_in_call(role),
                    "talkTimeSeconds": item.get("talkTimeSeconds"),
                    "talkTimeLabel": item.get("talkTimeLabel"),
                    "score": round(score, 2),
                    "label": label,
                    "strengths": _role_strength(role),
                    "watch": watch,
                    "areasToWork": [watch],
                }
            )
        return rows
    return [
        {
            "member": "Pod",
            "role": "Pod",
            "roleInCall": "Pod",
            "score": round(score, 2),
            "label": label,
            "strengths": "Discovery captured enough signal to prepare follow-up artifacts.",
            "watch": watch,
            "areasToWork": [watch],
        }
    ]


def _role_strength(role: str) -> str:
    if role == "ae":
        return "Kept the commercial discovery and next-step path moving from the call evidence available."
    if role == "se":
        return "Supported technical discovery and solution framing from the call evidence available."
    if role == "designer":
        return "Supported workflow and experience discovery from the call evidence available."
    return "Contributed to the discovery call and follow-up path."


CLIENT_EMAIL_UNSAFE_TERMS = (
    "bant",
    "bant coverage",
    "coverage finished",
    "jira",
    "agent envelope",
    "trace id",
    "model:",
    "cost:",
    "scorecard",
    "coaching",
    "internal",
    "open discovery gap",
    "open discovery gaps",
    "open gaps",
    "discovery gaps",
    "discovery coverage",
    "a few takeaways",
    "takeaways i captured",
    "call centered on discovery",
)


def _client_safe_text(value: str) -> bool:
    lowered = str(value or "").lower()
    return not any(term in lowered for term in CLIENT_EMAIL_UNSAFE_TERMS)


def _client_safe_lines(values: List[Any]) -> List[str]:
    return [str(item).strip() for item in values if str(item or "").strip() and _client_safe_text(str(item))]


def _client_safe_next_step(value: Any) -> str:
    text = str(value or "").strip()
    if text and _client_safe_text(text):
        return text
    return "I look forward to our next touch base and your feedback on the shared references."


def _client_email_fallback(
    account_name: str,
    recipients: List[str],
    summary: Dict[str, Any],
    commitments: List[str],
    gaps: List[str],
    email_attachments: Dict[str, List[Dict[str, Any]]],
    conversation_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    next_step = _client_safe_next_step(summary.get("nextStepProposal"))
    bullets = _client_safe_lines(summary.get("summary") or [])
    client_commitments = _client_safe_lines(commitments)
    requested_assets = [
        str(item.get("name") or "").strip()
        for item in (conversation_context or {}).get("requestedAssets", [])
        if str(item.get("name") or "").strip()
    ]
    needs = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("needs", [])
        if str(item.get("text") or "").strip()
    ]
    next_steps = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("nextSteps", [])
        if str(item.get("text") or "").strip()
    ]
    discussion_lines = _client_safe_lines([*needs[:3], *next_steps[:2], *bullets[:4]])
    if discussion_lines:
        deduped_lines: List[str] = []
        seen_lines: set[str] = set()
        for line in discussion_lines:
            key = re.sub(r"\s+", " ", line).strip().lower()
            if not key or key in seen_lines:
                continue
            seen_lines.add(key)
            deduped_lines.append(line)
        discussion_lines = deduped_lines
    body_lines = [
        "Hi,",
        "",
        "Thank you for the time today. I appreciated the discussion and the context your team shared.",
    ]
    if discussion_lines:
        body_lines.append("")
        body_lines.append("Minutes of meeting:")
        body_lines.extend(f"- {str(item).rstrip('.')}" for item in discussion_lines[:5])
    elif needs:
        body_lines.append("")
        body_lines.append("Minutes of meeting:")
        body_lines.extend(f"- {item}" for item in needs[:3])
    if requested_assets:
        body_lines.append("")
        body_lines.append("Materials we discussed:")
        body_lines.extend(f"- {item}" for item in requested_assets[:4])
    ready_attachments = [str(item.get("name") or "").strip() for item in email_attachments.get("found", []) if str(item.get("name") or "").strip()]
    if ready_attachments:
        body_lines.append("")
        body_lines.append("I will include the following attachments:")
        body_lines.extend(f"- {item}" for item in ready_attachments[:4])
    if client_commitments:
        body_lines.append("")
        body_lines.append("What we committed to:")
        body_lines.extend(f"- {item}" for item in client_commitments[:4])
    body_lines.extend(["", next_step, "", "Looking forward,"])
    return {
        "id": f"email-{call_safe_id(account_name)}",
        "audience": "client",
        "to": recipients,
        "cc": [],
        "subject": f"Follow-up from our {account_name} discovery call",
        "body_markdown": "\n".join(body_lines),
        "style_signals": ["concise", "consultative", "action-oriented"],
        "commitments_referenced": client_commitments,
        "status": "draft_pending_approval",
    }


def _internal_email_fallback(
    call_id: str,
    account_name: str,
    *,
    summary: Dict[str, Any],
    discovery_snapshot: Optional[Dict[str, Any]],
    task_list: List[Dict[str, Any]],
    conversation_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    coverage = _bant_coverage(discovery_snapshot)
    progression = _bant_progression(discovery_snapshot)
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    evidence = _bant_evidence(discovery_snapshot)
    gaps = _open_gaps(discovery_snapshot)
    needs = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("needs", [])
        if str(item.get("text") or "").strip()
    ]
    requested_assets = [
        str(item.get("name") or "").strip()
        for item in (conversation_context or {}).get("requestedAssets", [])
        if str(item.get("name") or "").strip()
    ]
    next_steps = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("nextSteps", [])
        if str(item.get("text") or "").strip()
    ]
    body_lines = [
        f"Internal Post-DC summary for {account_name}",
        "",
        f"BANT score: {round((coverage or 0) * 100)}%",
        "BANT details:",
        *[
            (
                f"- {BANT_LABELS[dim]}: {after.get(dim) or 'unknown'}"
                + (
                    f" — {(evidence.get(dim) or {}).get('value')}"
                    if (evidence.get(dim) or {}).get("value")
                    else ""
                )
            )
            for dim in ("budget", "authority", "need", "timeline")
        ],
    ]
    if gaps:
        body_lines.extend(["", "Open gaps:", *[f"- {BANT_LABELS.get(g, g)}" for g in gaps]])
    if needs:
        body_lines.extend(["", "Transcript context / buyer needs:", *[f"- {item}" for item in needs[:4]]])
    if requested_assets:
        body_lines.extend(["", "Requested assets:", *[f"- {item}" for item in requested_assets[:4]]])
    if next_steps:
        body_lines.extend(["", "Transcript next steps:", *[f"- {item}" for item in next_steps[:4]]])
    body_lines.extend(
        [
            "",
            "Next action items:",
            *[f"- [{task.get('owner') or 'Pod'}] {task.get('description')}" for task in task_list[:8]],
            "",
            f"Recommended next step: {summary.get('nextStepProposal') or 'Confirm next-step owner.'}",
        ]
    )
    return {
        "id": f"internal-email-{call_safe_id(call_id)}",
        "audience": "internal",
        "to": ["internal-team@dc-copilot.local"],
        "cc": [],
        "subject": f"Internal Post-DC action plan: {account_name}",
        "body_markdown": "\n".join(body_lines),
        "style_signals": ["internal", "action-oriented", "bant-focused"],
        "commitments_referenced": [str(task.get("description") or "") for task in task_list[:6] if task.get("description")],
        "status": "draft_pending_approval",
    }


def _email_attachments(
    ctx: TenantContext,
    call_brief: Optional[Dict[str, Any]],
    hits: List[Dict[str, Any]],
    *,
    account_name: str,
    conversation_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    brief = call_brief or {}
    plan = brief.get("artifactPlan") or []
    fulfillments = brief.get("artifactFulfillment") or []
    content_to_generate = brief.get("contentToGenerate") or []
    found: List[Dict[str, Any]] = []
    missing: List[Dict[str, Any]] = []
    used_assets: set[str] = set()
    repo = get_kb_repository()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)

    def asset_metadata(asset_id: str) -> Dict[str, Any]:
        if str(asset_id or "").startswith("dc:"):
            return {}
        row = repo.get_asset_row(tenant_uuid, asset_id, clerk_key)
        file_name = str((row or {}).get("file_name") or "")
        mime_type = str((row or {}).get("mime_type") or "")
        file_type = Path(file_name).suffix.lstrip(".").upper()
        if not file_type and "/" in mime_type:
            file_type = mime_type.split("/")[-1].split(".")[-1].upper()
        return {
            "fileName": file_name or None,
            "mimeType": mime_type or None,
            "fileType": file_type or "FILE",
        }

    def add_found(
        asset_id: str,
        name: str,
        snippet: str = "",
        reason: str = "",
        score: Any = None,
    ) -> None:
        clean_id = str(asset_id or "").strip()
        if not clean_id or clean_id in used_assets:
            return
        used_assets.add(clean_id)
        metadata = asset_metadata(clean_id)
        entry: Dict[str, Any] = {
            "name": name.strip() or "Relevant KB asset",
            "assetId": clean_id,
            "snippet": snippet[:240],
            "downloadUrl": f"/api/kb/assets/{clean_id}/file",
            "previewUrl": f"/api/kb/assets/{clean_id}/preview",
            "source": "knowledge_base",
            "reason": reason or "Retrieved from the knowledge base for this follow-up.",
            **{key: value for key, value in metadata.items() if value},
        }
        if score is not None:
            try:
                entry["matchScore"] = max(0.0, min(1.0, float(score)))
            except (TypeError, ValueError):
                pass
        found.append(entry)

    for hit in hits[:5]:
        asset_id = str(hit.get("asset_id") or "")
        if not asset_id:
            continue
        chunk_text = str(hit.get("chunk_text") or "")
        fields = _parse_kb_fields(chunk_text)
        add_found(
            asset_id,
            _title_from_hit(hit, fields),
            chunk_text,
            "Matched from KB search for the follow-up email attachment set.",
            score=hit.get("score"),
        )

    for row in fulfillments:
        if str(row.get("status") or "").lower() not in ("found", "partial"):
            continue
        asset_id = str(row.get("assetId") or "")
        if not asset_id:
            continue
        add_found(
            asset_id,
            str(row.get("name") or "Relevant KB asset"),
            str(row.get("snippet") or ""),
            "Matched from the Pre-DC KB fulfillment output.",
        )

    def add_missing(name: str, artifact_type: str, required_data: str) -> None:
        clean_name = str(name or "").strip() or "Follow-up asset"
        if any(item.get("name") == clean_name for item in missing):
            return
        clean_type = str(artifact_type or "one_pager").strip() or "one_pager"
        missing.append(
            {
                "name": clean_name,
                "requiredData": str(required_data or f"Create or tag a {clean_type} for this follow-up.").strip(),
                "contentStudioLink": (
                    f"/content/studio?template={quote(clean_type)}"
                    f"&account={quote(account_name)}&source=post-dc"
                ),
                "source": "content_gap",
            }
        )

    def found_matches(name: str) -> bool:
        needle_terms = {
            part
            for part in re.split(r"[^a-z0-9]+", str(name or "").lower())
            if len(part) > 2 and part not in {"the", "and", "for", "with"}
        }
        if not needle_terms:
            return False
        for item in found:
            haystack = f"{item.get('name', '')} {item.get('snippet', '')}".lower()
            if any(term in haystack for term in needle_terms):
                return True
        return False

    for asset in (conversation_context or {}).get("requestedAssets", []):
        name = str(asset.get("name") or "Requested follow-up asset")
        if found_matches(name):
            continue
        add_missing(
            name,
            str(asset.get("type") or "one_pager"),
            str(asset.get("requiredData") or asset.get("evidence") or ""),
        )

    for item in content_to_generate:
        add_missing(
            str(item.get("name") or "Follow-up asset"),
            str(item.get("type") or "one_pager"),
            _first_text(item.get("reason"), item.get("neededFor")),
        )

    plan_by_id = {str(item.get("id") or ""): item for item in plan}
    fulfilled_ids = {str(row.get("artifactId") or "") for row in fulfillments if str(row.get("status") or "").lower() == "found"}
    for row in fulfillments:
        status = str(row.get("status") or "").lower()
        if status not in ("missing", "partial"):
            continue
        artifact_id = str(row.get("artifactId") or "")
        planned = plan_by_id.get(artifact_id, {})
        add_missing(
            str(row.get("name") or planned.get("name") or "Follow-up asset"),
            str(planned.get("type") or "one_pager"),
            _first_text(row.get("requiredData"), planned.get("rationale")),
        )

    for item in plan:
        artifact_id = str(item.get("id") or "")
        if artifact_id and artifact_id in fulfilled_ids:
            continue
        if content_to_generate or fulfillments:
            continue
        add_missing(
            str(item.get("name") or "Follow-up asset"),
            str(item.get("type") or "one_pager"),
            str(item.get("rationale") or ""),
        )

    if not found and not missing:
        add_missing(
            f"{account_name} follow-up one-pager",
            "one_pager",
            "Create a concise follow-up asset because no matching KB attachment was found for this call.",
        )
    return {"found": found, "missing": missing}


def _clean_kb_value(value: Any) -> str:
    text = str(value or "").strip()
    if not text or text.upper() in {"N/A", "NA", "NONE", "NULL", "-"}:
        return ""
    return re.sub(r"\s+", " ", text)


def _parse_kb_fields(text: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for part in str(text or "").replace("\n", ";").split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        clean_key = _clean_kb_value(key)
        clean_value = _clean_kb_value(value)
        if clean_key and clean_value:
            fields[clean_key] = clean_value
    return fields


def _kb_field(fields: Dict[str, str], *keys: str) -> str:
    normalized = {" ".join(k.lower().replace("/", " ").split()): v for k, v in fields.items()}
    for key in keys:
        value = normalized.get(" ".join(key.lower().replace("/", " ").split()))
        if value:
            return value
    return ""


def _split_kb_terms(*values: str) -> List[str]:
    terms: List[str] = []
    for value in values:
        for part in re.split(r",|\||/", value or ""):
            term = _clean_kb_value(part)
            if term and term not in terms:
                terms.append(term)
    return terms[:7]


def _title_from_hit(hit: Dict[str, Any], fields: Dict[str, str]) -> str:
    metadata = hit.get("metadata") or {}
    title = _first_text(
        hit.get("title"),
        metadata.get("title"),
        metadata.get("name"),
        metadata.get("company"),
        _kb_field(fields, "Company", "Company Name", "Account", "Project"),
    )
    if title:
        return title
    asset_id = str(hit.get("asset_id") or "Knowledge base asset")
    return asset_id.replace("dc:", "").replace("-", " ").replace("_", " ").title()


def _kb_suggestion_from_hit(hit: Dict[str, Any], account_name: str) -> Dict[str, Any]:
    chunk_text = str(hit.get("chunk_text") or "")
    fields = _parse_kb_fields(chunk_text)
    title = _title_from_hit(hit, fields)
    industry = _kb_field(fields, "Industry", "LinkedIn Category", "LinkedIn Category / Sector")
    service = _kb_field(fields, "Service Line", "Solution", "Offering")
    tech_terms = _split_kb_terms(
        _kb_field(fields, "Technology"),
        _kb_field(fields, "Cloud Service"),
        _kb_field(fields, "Skill"),
        _kb_field(fields, "Platform"),
        _kb_field(fields, "Architecture"),
        _kb_field(fields, "Tool"),
    )

    reason_parts: List[str] = []
    if industry:
        reason_parts.append(industry)
    if service:
        reason_parts.append(service)

    if reason_parts and tech_terms:
        reason = f"Matches {', '.join(reason_parts)} with {', '.join(tech_terms)}."
    elif reason_parts:
        reason = f"Matches {', '.join(reason_parts)} context for this follow-up."
    elif tech_terms:
        reason = f"Matches the technology stack: {', '.join(tech_terms)}."
    else:
        snippet = re.sub(r"\s+", " ", chunk_text).strip()
        reason = snippet[:180] if snippet else f"Relevant to the {account_name} follow-up."

    suggested_use = "Use as supporting proof in the follow-up or proposal."
    if any(term.lower() in {"aws", "azure", "gcp"} for term in tech_terms):
        suggested_use = "Use for architecture, integration, or delivery-scope context."
    if industry:
        suggested_use = "Use as an industry-relevant proof point in the follow-up."

    asset_id = str(hit.get("asset_id") or "")
    suggestion = {
        "assetId": asset_id,
        "title": title,
        "reason": reason,
        "suggestedUse": suggested_use,
        "snippet": chunk_text[:240],
        "score": hit.get("score"),
    }
    if asset_id and not asset_id.startswith("dc:"):
        suggestion["downloadUrl"] = f"/api/kb/assets/{asset_id}/file"
    return suggestion


def call_safe_id(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "post-call"


def _task_list(
    call_id: str,
    account_name: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]],
    commitments: List[str],
    conversation_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    progression = _bant_progression(discovery_snapshot)
    is_qualifying = bool(progression.get("isQualifying"))
    tasks: List[Dict[str, Any]] = [
        {
            "id": f"task-{call_id}-follow-up",
            "task_type": "follow_up",
            "owner": "AE",
            "due_date": (now + timedelta(days=1)).isoformat(),
            "description": f"Review and send the follow-up email draft for {account_name}.",
            "status": "pending_approval",
            "isInternalAuto": False,
        },
        {
            "id": f"task-{call_id}-debrief",
            "task_type": "internal_review",
            "owner": "Pod",
            "due_date": (now + timedelta(days=2)).isoformat(),
            "description": "Run a short internal debrief and confirm owners for next steps.",
            "status": "pending_approval",
            "isInternalAuto": True,
        },
    ]
    for gap in _open_gaps(discovery_snapshot):
        label = BANT_LABELS.get(gap, gap.replace("_", " ").title())
        tasks.append(
            {
                "id": f"task-{call_id}-gap-{gap}",
                "task_type": "internal_review",
                "owner": "AE",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": f"Clarify the open discovery gap: {label}.",
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    for i, commitment in enumerate(commitments[:3]):
        tasks.append(
            {
                "id": f"task-{call_id}-commitment-{i + 1}",
                "task_type": "follow_up",
                "owner": "AE",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": commitment,
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    for i, asset in enumerate((conversation_context or {}).get("requestedAssets", [])[:4]):
        name = str(asset.get("name") or "Requested follow-up asset").strip()
        if not name:
            continue
        tasks.append(
            {
                "id": f"task-{call_id}-asset-{i + 1}",
                "task_type": "content_request",
                "owner": "Pod",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": f"Prepare or attach {name}. Evidence from transcript: {asset.get('evidence')}",
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    for i, need in enumerate((conversation_context or {}).get("needs", [])[:3]):
        text = str(need.get("text") or "").strip()
        if not text:
            continue
        tasks.append(
            {
                "id": f"task-{call_id}-need-{i + 1}",
                "task_type": "internal_review",
                "owner": "Pod",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": f"Address transcript need in the follow-up: {text}",
                "status": "pending_approval",
                "isInternalAuto": True,
            }
        )
    for i, next_step in enumerate((conversation_context or {}).get("nextSteps", [])[:3]):
        text = str(next_step.get("text") or "").strip()
        if not text:
            continue
        tasks.append(
            {
                "id": f"task-{call_id}-next-step-{i + 1}",
                "task_type": (
                    "schedule_next_meeting"
                    if re.search(r"\b(schedule|meeting|review|readout|follow up)\b", text, re.I)
                    else "follow_up"
                ),
                "owner": "AE",
                "due_date": (now + timedelta(days=2)).isoformat(),
                "description": f"Confirm the discussed next step: {text}",
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    if is_qualifying:
        tasks.append(
            {
                "id": f"task-{call_id}-next-meeting",
                "task_type": "schedule_next_meeting",
                "owner": "AE",
                "due_date": (now + timedelta(days=3)).isoformat(),
                "description": "Schedule the next meeting with the economic buyer and technical stakeholders.",
                "status": "pending_approval",
                "isInternalAuto": False,
            }
        )
    return tasks


JIRA_FINANCIAL_RE = re.compile(
    r"(\$|€|£|\b(?:budget|financial|finance|financing|revenue|roi|pricing|price|cost|"
    r"investment|unit economics|cfo|economic buyer|board approval|approval path|"
    r"annual potential|year-one|year one|bant|open discovery gap|open discovery gaps|"
    r"discovery gaps|discovery coverage)\b)",
    re.I,
)

JIRA_TIMELINE_RE = re.compile(
    r"\b(?:timeline|pilot|poc|proof of concept|launch|go-live|production|readout|"
    r"next step|follow up|schedule|meeting|workshop|proposal|by|before|after|q[1-4]|"
    r"week|month|date|deadline)\b",
    re.I,
)


def _jira_safe_line(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text or JIRA_FINANCIAL_RE.search(text):
        return ""
    return text


def _jira_safe_lines(values: List[Any], *, limit: int) -> List[str]:
    out: List[str] = []
    seen: set[str] = set()
    for value in values:
        text = _jira_safe_line(value)
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _jira_description(
    account_name: str,
    *,
    summary: Dict[str, Any],
    task_list: List[Dict[str, Any]],
    conversation_context: Optional[Dict[str, Any]],
) -> str:
    summary_lines = _jira_safe_lines(
        [summary.get("headline"), *(summary.get("summary") or [])],
        limit=4,
    )
    needs = _jira_safe_lines(
        [item.get("text") for item in (conversation_context or {}).get("needs", []) if isinstance(item, dict)],
        limit=4,
    )
    requested_assets = _jira_safe_lines(
        [item.get("name") for item in (conversation_context or {}).get("requestedAssets", []) if isinstance(item, dict)],
        limit=4,
    )
    next_steps_source = [
        item.get("text")
        for item in (conversation_context or {}).get("nextSteps", [])
        if isinstance(item, dict)
    ]
    next_steps_source.extend(task.get("description") for task in task_list)
    timeline_lines = [
        line
        for line in _jira_safe_lines(next_steps_source, limit=8)
        if JIRA_TIMELINE_RE.search(line)
    ][:4]
    action_items = _jira_safe_lines(
        [task.get("description") for task in task_list],
        limit=6,
    )

    sections = [
        "Client summary:",
        *(f"- {line}" for line in (summary_lines or [f"{account_name} post-discovery follow-up."])),
        "",
        "Client details / needs:",
        *(f"- {line}" for line in (needs or ["Confirm the client needs captured in the discovery call."])),
    ]
    if timeline_lines:
        sections.extend(["", "Timeline / POC:", *(f"- {line}" for line in timeline_lines)])
    if requested_assets:
        sections.extend(["", "Needed materials:", *(f"- {line}" for line in requested_assets)])
    sections.extend(
        [
            "",
            "Action items:",
            *(f"- {line}" for line in (action_items or ["Assign owner for the next client follow-up."])),
        ]
    )
    return "\n".join(sections)


def _money_value(raw: str) -> float:
    match = re.search(r"([\d,.]+)\s*([kmb])?", raw.lower())
    if not match:
        return 0.0
    value = float(match.group(1).replace(",", ""))
    suffix = match.group(2)
    if suffix == "k":
        return value * 1_000
    if suffix == "m":
        return value * 1_000_000
    if suffix == "b":
        return value * 1_000_000_000
    return value


def _money_values(raw: str) -> List[float]:
    matches = re.findall(r"([\d,.]+)\s*([kmb])?", str(raw or "").lower())
    if not matches:
        return []
    first_suffix = next((suffix for _, suffix in matches if suffix), "")
    values: List[float] = []
    for amount, suffix in matches:
        try:
            value = float(amount.replace(",", ""))
        except ValueError:
            continue
        unit = suffix or (first_suffix if value < 1000 else "")
        if unit == "k":
            value *= 1_000
        elif unit == "m":
            value *= 1_000_000
        elif unit == "b":
            value *= 1_000_000_000
        values.append(value)
    return values


def _annual_potential_from_budget(value: str) -> str:
    amounts = _money_values(value)
    if not amounts:
        return ""
    largest = max(amounts)
    if largest >= 250_000:
        return "High Potential"
    if largest >= 50_000:
        return "Medium Potential"
    return "Low Potential"


def _conversation_text(transcript_events: Optional[List[Dict[str, Any]]], conversation_context: Optional[Dict[str, Any]]) -> str:
    parts = [
        _transcript_full_text(transcript_events),
        " ".join(str(item.get("text") or "") for item in (conversation_context or {}).get("needs", []) if isinstance(item, dict)),
        " ".join(str(item.get("text") or "") for item in (conversation_context or {}).get("nextSteps", []) if isinstance(item, dict)),
        " ".join(str(item.get("name") or "") for item in (conversation_context or {}).get("requestedAssets", []) if isinstance(item, dict)),
        " ".join(str(item) for item in (conversation_context or {}).get("focusAreas", []) if str(item).strip()),
    ]
    return re.sub(r"\s+", " ", " ".join(parts)).strip().lower()


def _infer_engagement_model(text: str) -> str:
    if re.search(r"\b(fixed\s*cost|fixed[-\s]?price|fixed\s*bid)\b", text):
        return "Fixed Cost"
    if re.search(r"\b(time\s*(?:and|&)\s*material|t\s*&\s*m|hourly)\b", text):
        return "Time & Material"
    if re.search(r"\b(retainer|managed\s+team|dedicated\s+team)\b", text):
        return "Retainer"
    if re.search(r"\b(pilot|poc|proof\s+of\s+concept|discovery\s+sprint)\b", text):
        return "Pilot"
    return ""


def _infer_service_line(text: str) -> str:
    if re.search(r"\b(erp|software\s+engineering|custom\s+software|application|app|portal|platform|"
                 r"scheduling|payroll|billing|incident\s+reporting|client\s+communications)\b", text):
        return "Software Engineering"
    if re.search(r"\b(ai|automation|llm|agentic|machine\s+learning|ml|chatbot)\b", text):
        return "AI / Automation"
    if re.search(r"\b(data|analytics|dashboard|bi|reporting|warehouse)\b", text):
        return "Data & Analytics"
    if re.search(r"\b(cloud|aws|azure|gcp|devops|integration|architecture)\b", text):
        return "Cloud & Integration"
    if re.search(r"\b(ux|ui|design|prototype|product\s+design)\b", text):
        return "Product Design"
    return ""


def _best_next_step(conversation_context: Optional[Dict[str, Any]]) -> str:
    candidates = [
        str(item.get("text") or "").strip()
        for item in (conversation_context or {}).get("nextSteps", [])
        if isinstance(item, dict) and str(item.get("text") or "").strip()
    ]
    for candidate in candidates:
        if re.search(r"\b(send|share|proposal|implementation|schedule|review|meeting|follow\s*up|workshop|readout)\b", candidate, re.I):
            return candidate
    for candidate in candidates:
        if not re.search(r"\b(timeline|deadline)\b", candidate, re.I):
            return candidate
    return candidates[0] if candidates else ""


def _deal_signals(
    account_name: str,
    *,
    call: Optional[Dict[str, Any]],
    discovery_snapshot: Optional[Dict[str, Any]],
    pre_dc_fields: Optional[Dict[str, str]],
    post_dc_record: Optional[Dict[str, Any]],
    conversation_context: Optional[Dict[str, Any]],
    transcript_events: Optional[List[Dict[str, Any]]],
    summary: Optional[Dict[str, Any]],
) -> Dict[str, str]:
    coverage = _bant_coverage(discovery_snapshot) or 0
    progression = _bant_progression(discovery_snapshot)
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    evidence = _bant_evidence(discovery_snapshot)
    transcript_evidence = _transcript_bant_evidence(transcript_events)
    text = _conversation_text(transcript_events, conversation_context)

    dims = ("budget", "authority", "need", "timeline")
    is_qualified = all(
        after.get(dim) == "confirmed" or (transcript_evidence.get(dim) or {}).get("status") == "confirmed"
        for dim in dims
    )
    effective_coverage = max(
        coverage,
        sum(
            1
            for dim in dims
            if after.get(dim) in ("confirmed", "partial") or evidence.get(dim) or transcript_evidence.get(dim)
        )
        / len(dims),
    )
    lead_stage = _first_text(
        _post_field(post_dc_record, "Lead Stage"),
        "Opportunity"
        if is_qualified or effective_coverage >= 0.75
        else "Qualified follow-up"
        if effective_coverage >= 0.5
        else "Discovery",
        (call or {}).get("dealStage"),
    )
    budget_value = _first_text(
        _post_field(post_dc_record, "Budget"),
        (evidence.get("budget") or {}).get("value"),
        (evidence.get("budget") or {}).get("snippet"),
    )
    annual_potential = _first_text(
        _post_field(post_dc_record, "Accounts Annual Potential"),
        _annual_potential_from_budget(budget_value),
    )
    engagement_model = _first_text(
        _post_field(post_dc_record, "Engagement Model"),
        _infer_engagement_model(text),
    )
    service_line = _first_text(
        _post_field(post_dc_record, "Service Line"),
        _infer_service_line(text),
        (pre_dc_fields or {}).get("Campaign Service - PreDC"),
    )
    pre_dc_icp_correct = _post_field(post_dc_record, "Was Pre DC ICP bucket correct")
    next_step = _first_text(
        _best_next_step(conversation_context),
        (summary or {}).get("nextStepProposal"),
    )

    signals = {
        "leadStage": lead_stage,
        "annualPotential": annual_potential,
        "engagementModel": engagement_model,
        "serviceLine": service_line,
        "preDcIcpCorrect": pre_dc_icp_correct,
        "nextStep": next_step,
    }
    return {
        key: re.sub(r"\s+", " ", str(value or "")).strip()[:240]
        for key, value in signals.items()
        if str(value or "").strip()
    }


def _jira_ticket(
    call_id: str,
    account_name: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]],
    pre_dc_fields: Optional[Dict[str, str]],
    post_dc_record: Optional[Dict[str, Any]],
    summary: Dict[str, Any],
    task_list: List[Dict[str, Any]],
    cfg: Dict[str, Any],
    conversation_context: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    progression = _bant_progression(discovery_snapshot)
    after = progression.get("after") if isinstance(progression.get("after"), dict) else {}
    bant_snapshot = {
        dim: after.get(dim) == "confirmed"
        for dim in ("budget", "authority", "need", "timeline")
    }
    is_qualified = all(bant_snapshot.values())
    if not is_qualified:
        return None

    service_line = _first_text(
        _post_field(post_dc_record, "Service Line"),
        (pre_dc_fields or {}).get("Campaign Service - PreDC"),
        "services",
    )
    jira_cfg = cfg.get("jira") or {}
    coverage = _bant_coverage(discovery_snapshot) or 0
    priority = "High" if is_qualified or coverage >= 0.75 else "Medium"
    project_key = str(jira_cfg.get("project_key") or "SALES")
    icp_bucket = _first_text((pre_dc_fields or {}).get("ICP Bucket"), _post_field(post_dc_record, "Was Pre DC ICP bucket correct"))
    labels = ["discovery-call", "bant-qualified"]
    if icp_bucket:
        labels.append(re.sub(r"[^a-z0-9]+", "-", icp_bucket.lower()).strip("-")[:40])
    description = _jira_description(
        account_name,
        summary=summary,
        task_list=task_list,
        conversation_context=conversation_context,
    )
    return {
        "status": "draft_pending_approval",
        "summary": f"[{'DC Qualified' if is_qualified else 'DC Follow-up'}] {account_name} — {service_line} opportunity",
        "description": description,
        "issueType": str(jira_cfg.get("issue_type") or "Task"),
        "priority": priority,
        "labels": labels,
        "projectKey": project_key,
        "bantSnapshot": bant_snapshot,
        "callId": call_id,
    }


def _research_sections(post_dc_record: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    fields = (post_dc_record or {}).get("fields") or {}
    if not fields:
        return []
    groups = [
        (
            "Post-DC outcome",
            ["Lead Stage", "Bottom Line Context", "Sales Strategy", "Reason Not A Fit - Post-DC"],
        ),
        (
            "Qualification",
            ["Budget", "Authority", "Need", "Timeline", "Was Pre DC ICP bucket correct"],
        ),
        (
            "Commercial context",
            ["Accounts Annual Potential", "Engagement Model", "Service Line", "Additional Info", "Attendees"],
        ),
    ]
    sections: List[Dict[str, Any]] = []
    for title, keys in groups:
        items = [
            {"label": key, "value": str(fields.get(key) or "").strip()}
            for key in keys
            if str(fields.get(key) or "").strip()
        ]
        if items:
            sections.append({"title": title, "items": items})
    return sections


def _citations(
    call_id: str,
    account_name: str,
    *,
    transcript_excerpt: str,
    pre_dc_fields: Optional[Dict[str, str]],
    hits: List[Dict[str, Any]],
) -> List[Citation]:
    citations: List[Citation] = [
        Citation(
            source_type="transcript",
            source_id=call_id,
            snippet=transcript_excerpt[:200] or f"Post-call artifacts for {account_name}",
            confidence=0.78,
        )
    ]
    crm_snippet = _first_text(
        (pre_dc_fields or {}).get("Have they described their needs"),
        (pre_dc_fields or {}).get("Company Description"),
        (pre_dc_fields or {}).get("Industry - PreDC"),
    )
    if crm_snippet:
        citations.append(
            Citation(
                source_type="crm_record",
                source_id=call_id,
                snippet=crm_snippet[:200],
                confidence=0.82,
            )
        )
    for i, hit in enumerate(hits[:2]):
        citations.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or "")[:200],
                confidence=float(hit.get("score", 0.7) or 0.7),
            )
        )
    return citations


def run_post_dc_pipeline(
    ctx: TenantContext,
    call_id: str,
    *,
    call: Optional[Dict[str, Any]] = None,
    pre_dc_fields: Optional[Dict[str, str]] = None,
    call_brief: Optional[Dict[str, Any]] = None,
    discovery_snapshot: Optional[Dict[str, Any]] = None,
    live_snapshot: Optional[Dict[str, Any]] = None,
    live_suggestions: Optional[List[Dict[str, Any]]] = None,
    transcript_events: Optional[List[Dict[str, Any]]] = None,
    call_agent_handoff: Optional[Dict[str, Any]] = None,
    post_dc_record: Optional[Dict[str, Any]] = None,
) -> AgentEnvelope:
    settings = get_settings()
    cfg = get_agent_config_repository().get_config(ctx, "post_dc")
    model_policy = cfg.get("model_policy") or {}
    model = model_policy.get("model_name") or "gpt-5.4-mini"
    fallback = model_policy.get("fallback_model_name") or "gpt-5.4-mini"
    llm = LlmClient(openai_api_key=settings.openai_api_key or None)

    account_name = _account_name(call, pre_dc_fields, call_id)
    transcript_excerpt = _transcript_excerpt(transcript_events)
    transcript_digest = _transcript_digest(transcript_events)
    pod_talk_time = _pod_talk_time(transcript_events)
    live_suggestion_context = _live_suggestions_context(live_suggestions)
    conversation_context = _conversation_context(transcript_events, live_snapshot)
    gaps = _open_gaps(discovery_snapshot)
    recipients = _extract_recipients(call, pre_dc_fields)
    requested_asset_query = " ".join(
        str(item.get("name") or "")
        for item in conversation_context.get("requestedAssets", [])
        if str(item.get("name") or "").strip()
    )
    transcript_need_query = " ".join(
        str(item.get("text") or "")
        for item in conversation_context.get("needs", [])[:3]
        if str(item.get("text") or "").strip()
    )
    kb_query = " ".join(
        part
        for part in [
            account_name,
            (pre_dc_fields or {}).get("Industry - PreDC"),
            (pre_dc_fields or {}).get("Campaign Service - PreDC"),
            _post_field(post_dc_record, "Service Line"),
            requested_asset_query,
            transcript_need_query,
            "follow-up case study next steps",
        ]
        if part
    )
    hits, _ = _kb_search(ctx, kb_query, limit=4)
    agent_inputs = _agent_input_summary(
        transcript_events=transcript_events,
        live_snapshot=live_snapshot,
        live_suggestions=live_suggestions,
        discovery_snapshot=discovery_snapshot,
        call_agent_handoff=call_agent_handoff,
        source_record_count=sum(1 for item in (call, pre_dc_fields, call_brief, post_dc_record) if item),
        kb_hit_count=len(hits),
    )
    call_agent_outputs = call_agent_handoff or {
        "discovery_snapshot": _snapshot_result(discovery_snapshot),
        "live_signal_snapshot": live_snapshot or {},
        "live_suggestions": live_suggestion_context,
        "transcript_event_count": len(transcript_events or []),
        "transcript_digest": transcript_digest,
    }

    context = {
        "call_id": call_id,
        "account_name": account_name,
        "call": call or {},
        "pre_dc_fields": pre_dc_fields or {},
        "call_brief": call_brief or {},
        "discovery_snapshot": _snapshot_result(discovery_snapshot),
        "live_snapshot": live_snapshot or {},
        "live_suggestions": live_suggestion_context,
        "post_dc_record": post_dc_record or {},
        "transcript_excerpt": transcript_excerpt,
        "transcript_digest": transcript_digest,
        "pod_talk_time": pod_talk_time,
        "transcript_events": _transcript_event_payload(transcript_events),
        "conversation_context": conversation_context,
        "call_agent_outputs": call_agent_outputs,
        "agent_inputs": agent_inputs,
        "kb_hits": hits[:4],
    }

    total_tokens = 0
    total_cost = 0.0
    trace_id = str(uuid.uuid4())
    model_used = "heuristic"

    summary_prompt = resolve_prompt(cfg, "summary", "post_dc/summary.txt")
    email_prompt = resolve_prompt(cfg, "email", "post_dc/email.txt")
    coaching_prompt = resolve_prompt(cfg, "coaching", "post_dc/coaching.txt")

    summary_json: Dict[str, Any] = {}
    if settings.openai_configured:
        completion = llm.complete(
            system=summary_prompt,
            user=json.dumps(context, ensure_ascii=False),
            model=model,
            fallback_model=fallback,
        )
        summary_json = _extract_json_block(completion.text) or {}
        total_tokens += completion.tokens_in + completion.tokens_out
        total_cost += completion.cost_usd
        trace_id = completion.trace_id
        model_used = completion.model

    fallback_summary = _summary_fallback(
        account_name,
        discovery_snapshot=discovery_snapshot,
        live_snapshot=live_snapshot,
        pre_dc_fields=pre_dc_fields,
        post_dc_record=post_dc_record,
        conversation_context=conversation_context,
    )
    summary_json = (
        _merge_summary_with_completed_call_evidence(summary_json, fallback_summary)
        if summary_json
        else fallback_summary
    )

    commitments = _commitments(transcript_events, live_snapshot, summary_json)
    task_list = _task_list(
        call_id,
        account_name,
        discovery_snapshot=discovery_snapshot,
        commitments=commitments,
        conversation_context=conversation_context,
    )
    email_attachments = _email_attachments(
        ctx,
        call_brief,
        hits,
        account_name=account_name,
        conversation_context=conversation_context,
    )

    email_json: Dict[str, Any] = {}
    if settings.openai_configured:
        email_context = {
            **context,
            "summary": summary_json,
            "commitments": commitments,
            "recipients": recipients,
            "open_gaps": gaps,
            "task_list": task_list,
            "email_attachments": email_attachments,
        }
        completion = llm.complete(
            system=email_prompt,
            user=json.dumps(email_context, ensure_ascii=False),
            model=model,
            fallback_model=fallback,
        )
        email_json = _extract_json_block(completion.text) or {}
        total_tokens += completion.tokens_in + completion.tokens_out
        total_cost += completion.cost_usd

    if not email_json:
        email_json = _client_email_fallback(
            account_name,
            recipients,
            summary_json,
            commitments,
            gaps,
            email_attachments,
            conversation_context=conversation_context,
        )
    client_fallback_email = _client_email_fallback(
        account_name,
        recipients,
        summary_json,
        commitments,
        gaps,
        email_attachments,
        conversation_context=conversation_context,
    )
    raw_body = str(email_json.get("body_markdown") or email_json.get("body") or "")
    if not raw_body or not _client_safe_text(raw_body):
        raw_body = str(client_fallback_email.get("body_markdown") or "")
    raw_subject = str(email_json.get("subject") or f"Follow-up from our {account_name} discovery call")
    if not _client_safe_text(raw_subject):
        raw_subject = f"Follow-up from our {account_name} discussion"
    raw_commitments = (
        email_json.get("commitments_referenced")
        if isinstance(email_json.get("commitments_referenced"), list)
        else commitments
    )

    email_draft = {
        "id": str(email_json.get("id") or f"email-{call_safe_id(call_id)}"),
        "audience": "client",
        "to": email_json.get("to") if isinstance(email_json.get("to"), list) else recipients,
        "cc": email_json.get("cc") if isinstance(email_json.get("cc"), list) else [],
        "subject": raw_subject,
        "body_markdown": raw_body,
        "style_signals": email_json.get("style_signals")
        if isinstance(email_json.get("style_signals"), list)
        else ["concise", "consultative"],
        "commitments_referenced": _client_safe_lines(raw_commitments),
        "status": "draft_pending_approval",
        "attachments": email_attachments,
    }
    internal_email_draft = _internal_email_fallback(
        call_id,
        account_name,
        summary=summary_json,
        discovery_snapshot=discovery_snapshot,
        task_list=task_list,
        conversation_context=conversation_context,
    )

    scorecard = _scorecard_fallback(discovery_snapshot, live_snapshot, pod_talk_time)
    if settings.openai_configured:
        coaching_context = {
            **context,
            "summary": summary_json,
            "open_gaps": gaps,
            "bant_progression": _bant_progression(discovery_snapshot),
        }
        completion = llm.complete(
            system=coaching_prompt,
            user=json.dumps(coaching_context, ensure_ascii=False),
            model=model,
            fallback_model=fallback,
        )
        parsed = _extract_json_block(completion.text) or {}
        parsed_scorecard = parsed.get("podScorecard")
        if isinstance(parsed_scorecard, list) and parsed_scorecard:
            scorecard = _normalize_scorecard_rows(parsed_scorecard, pod_talk_time)
        total_tokens += completion.tokens_in + completion.tokens_out
        total_cost += completion.cost_usd
    else:
        scorecard = _normalize_scorecard_rows(scorecard, pod_talk_time)

    review = {
        "headline": str(summary_json.get("headline") or f"{account_name} post-call review"),
        "summary": summary_json.get("summary") if isinstance(summary_json.get("summary"), list) else [],
        "nextStepProposal": str(summary_json.get("nextStepProposal") or "").strip(),
        "researchSections": _research_sections(post_dc_record),
        "podScorecard": scorecard,
        "learned": _learned(discovery_snapshot, post_dc_record),
        "bantScore": _bant_score(discovery_snapshot, post_dc_record, transcript_events),
        "dealSignals": _deal_signals(
            account_name,
            call=call,
            discovery_snapshot=discovery_snapshot,
            pre_dc_fields=pre_dc_fields,
            post_dc_record=post_dc_record,
            conversation_context=conversation_context,
            transcript_events=transcript_events,
            summary=summary_json,
        ),
        "openDiscoveryGaps": gaps,
        "discoveryBantCoverage": _bant_coverage(discovery_snapshot),
    }
    if not review["summary"]:
        review["summary"] = _summary_fallback(
            account_name,
            discovery_snapshot=discovery_snapshot,
            live_snapshot=live_snapshot,
            pre_dc_fields=pre_dc_fields,
            post_dc_record=post_dc_record,
            conversation_context=conversation_context,
        )["summary"]

    jira_ticket = _jira_ticket(
        call_id,
        account_name,
        discovery_snapshot=discovery_snapshot,
        pre_dc_fields=pre_dc_fields,
        post_dc_record=post_dc_record,
        summary=summary_json,
        task_list=task_list,
        cfg=cfg,
        conversation_context=conversation_context,
    )

    citations = _citations(
        call_id,
        account_name,
        transcript_excerpt=transcript_excerpt,
        pre_dc_fields=pre_dc_fields,
        hits=hits,
    )

    envelope = AgentEnvelope(
        agent="post_dc",
        operation="review_produced",
        result={
            "callId": call_id,
            "accountName": account_name,
            "review": review,
            "task": {
                "emailDraft": email_draft,
                "clientEmailDraft": email_draft,
                "internalEmailDraft": internal_email_draft,
                "taskList": task_list,
            },
            "emailAttachments": email_attachments,
            "jiraTicket": jira_ticket,
            "coaching": {
                "podScorecard": scorecard,
                "bantProgression": _bant_progression(discovery_snapshot),
            },
            "agentInputs": agent_inputs,
            "kbSuggestions": [
                _kb_suggestion_from_hit(hit, account_name)
                for hit in hits[:3]
            ],
        },
        citations=citations,
        confidence=0.82,
        cost={"tokens": total_tokens, "usd": total_cost, "model": model_used},
        trace_id=trace_id,
    )
    validate_envelope(envelope)
    return envelope
