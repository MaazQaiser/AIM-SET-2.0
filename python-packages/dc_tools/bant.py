from __future__ import annotations

import re
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Tuple

BANTDimension = Literal["budget", "authority", "need", "timeline"]
BANTStatus = Literal["confirmed", "partial", "unknown"]
ChecklistItemStatus = Literal["pending", "partial", "confirmed", "not_applicable"]
ChecklistItemTier = Literal["bant", "secondary"]

BANT_ITEM_IDS: Tuple[str, ...] = ("budget", "authority", "need", "timeline")
SECONDARY_ITEM_IDS: Tuple[str, ...] = (
    "success_criteria",
    "stakeholders",
    "decision_process",
    "current_state",
    "competition",
    "next_step",
    "compliance_security",
    "engagement_fit",
)

ITEM_LABELS: Dict[str, str] = {
    "budget": "Budget",
    "authority": "Authority",
    "need": "Need",
    "timeline": "Timeline",
    "success_criteria": "Success criteria",
    "stakeholders": "Stakeholders",
    "decision_process": "Decision process",
    "current_state": "Current state",
    "competition": "Competition",
    "next_step": "Next step",
    "compliance_security": "Compliance & security",
    "engagement_fit": "Engagement fit",
}

DEFAULT_PLAYBOOK: Dict[str, str] = {
    "budget": "What budget range is approved, and who signs off?",
    "authority": "Who else must be involved before you can move forward?",
    "need": "If we solved this, what metric moves first?",
    "timeline": "What has to be true before the board says yes?",
    "success_criteria": "What does success look like in the next 90 days?",
    "stakeholders": "Who else evaluates this initiative?",
    "decision_process": "What are the steps to a yes?",
    "current_state": "Walk me through how you handle this today.",
    "competition": "What alternatives are you comparing?",
    "next_step": "Can we lock a follow-up with the right attendees?",
    "compliance_security": "Any regulatory or security constraints we should plan for?",
    "engagement_fit": "What engagement model fits best for this scope?",
}

# keyword groups -> item id, minimum match tier (partial vs confirmed)
SIGNAL_RULES: List[Tuple[str, List[str], ChecklistItemStatus]] = [
    ("budget", ["budget", "pricing", "cost", "spend", "investment", "approved budget", "dollar", "price", "afford", "expensive", "cheap", "limited budget", "money", "funding", "financial", "carved", "envelope", "year one", "year-one", "four hundred", "six hundred", "million", "thousand", "budget owner", "budget range"], "partial"),
    ("budget", ["budget approved", "allocated", "signed off", "funding approved", "set aside", "earmarked", "board still has to bless", "board has to bless"], "confirmed"),
    ("authority", ["decision maker", "economic buyer", "sign off", "cio", "cto", "cfo", "ceo", "coo", "cpo", "vp ", "director", "board", "head of", "budget owner", "final approver", "signatory", "approval committee", "steering committee"], "partial"),
    ("authority", ["reports to", "final say", "signatory", "approves", "approve it", "need to approve", "must approve", "has to approve", "board approval", "board bless", "approval path", "owns the decision", "own the decision", "i decide", "my call", "i approve"], "confirmed"),
    ("need", ["pain", "problem", "challenge", "struggling", "need to", "priority", "impact", "pain point", "overcome", "solution", "looking for", "looking forward", "require", "want to", "wish we", "gap", "issue", "bottleneck", "friction", "limitation", "automat"], "partial"),
    ("need", ["must have", "critical", "urgent need", "business case", "top priority", "deal breaker", "non-negotiable"], "confirmed"),
    ("timeline", ["timeline", "eta", "estimated time", "estimated delivery", "delivery date", "completion date", "deadline", "go-live", "go live", "launch", "q1", "q2", "q3", "q4", "by end of", "this quarter", "next quarter", "this year", "next month", "asap", "soon", "urgent", "immediately", "production-grade", "pilot", "next year", "kickoff", "rollout"], "partial"),
    ("timeline", ["project eta", "board meeting", "decision by", "kick off", "kickoff", "pilot kickoff", "start date", "go live date", "go-live by", "production go-live", "target date", "production-grade by", "complete by", "delivery by"], "confirmed"),
    ("success_criteria", ["success looks like", "success criteria", "kpi", "outcome", "measure", "metric"], "partial"),
    ("stakeholders", ["stakeholder", "who else", "involved", "team members", "evaluating", "colleague"], "partial"),
    ("decision_process", ["procurement", "rfp", "evaluation process", "steps to", "approval process"], "partial"),
    ("current_state", ["currently", "today we", "our stack", "existing system", "right now", "at the moment", "traditional", "legacy", "manual", "as compared to"], "partial"),
    ("competition", ["competitor", "alternative", "incumbent", "build in-house", "vendor", "compared to", "other tool", "other solution"], "partial"),
    ("next_step", ["follow up", "next meeting", "schedule", "send proposal", "loop in", "next step", "moving forward"], "partial"),
    ("next_step", ["booked for", "calendar invite", "see you next", "let's schedule"], "confirmed"),
    ("compliance_security", ["compliance", "regulatory", "soc 2", "gdpr", "audit", "security requirement"], "partial"),
    ("engagement_fit", ["engagement model", "staff aug", "fixed price", "t&m", "outsource", "contract", "pilot", "poc", "proof of concept"], "partial"),
]

DEFAULT_NUDGE_THRESHOLDS_SECONDS: Dict[str, int] = {
    "budget": 30 * 60,
    "authority": 20 * 60,
    "need": 15 * 60,
    "timeline": 25 * 60,
    "next_step": 40 * 60,
}


@dataclass
class BantProgressionResult:
    before: Dict[str, BANTStatus]
    after: Dict[str, BANTStatus]
    delta: int
    is_qualifying: bool


@dataclass
class ChecklistEvidence:
    snippet: str
    transcript_offset_seconds: Optional[float] = None
    confidence: float = 0.7
    value: str = ""
    sentiment: Optional[str] = None
    speaker_role: Optional[str] = None
    signal_type: Optional[str] = None


@dataclass
class ChecklistItemState:
    id: str
    label: str
    tier: ChecklistItemTier
    status: ChecklistItemStatus
    suggested_question: str = ""
    evidence: List[ChecklistEvidence] = field(default_factory=list)


@dataclass
class DiscoveryChecklistState:
    call_id: str
    coverage: float
    bant_coverage: float
    bant: Dict[str, BANTStatus]
    items: List[ChecklistItemState]
    elapsed_seconds: int = 0
    open_gaps: List[str] = field(default_factory=list)
    nudge_history: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "callId": self.call_id,
            "coverage": round(self.coverage, 3),
            "bantCoverage": round(self.bant_coverage, 3),
            "bant": dict(self.bant),
            "items": [
                {
                    "id": it.id,
                    "label": it.label,
                    "tier": it.tier,
                    "status": it.status,
                    "suggestedQuestion": it.suggested_question,
                    "evidence": [
                        {
                            "snippet": e.snippet,
                            "transcriptOffsetSeconds": e.transcript_offset_seconds,
                            "confidence": e.confidence,
                            "value": e.value,
                            "sentiment": e.sentiment,
                            "speakerRole": e.speaker_role,
                            "signalType": e.signal_type,
                        }
                        for e in it.evidence
                    ],
                }
                for it in self.items
            ],
            "elapsedSeconds": self.elapsed_seconds,
            "openGaps": list(self.open_gaps),
            "nudgeHistory": dict(self.nudge_history),
            "updatedAt": _iso_now(),
        }


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _status_rank(status: ChecklistItemStatus) -> int:
    order = {"pending": 0, "partial": 1, "confirmed": 2, "not_applicable": 3}
    return order.get(status, 0)


def _merge_status(current: ChecklistItemStatus, new: ChecklistItemStatus) -> ChecklistItemStatus:
    if current == "not_applicable" or new == "not_applicable":
        return current if _status_rank(current) >= _status_rank(new) else new
    return current if _status_rank(current) >= _status_rank(new) else new


def _bant_status_to_checklist(status: BANTStatus) -> ChecklistItemStatus:
    if status == "confirmed":
        return "confirmed"
    if status == "partial":
        return "partial"
    return "pending"


def _checklist_to_bant(items: List[ChecklistItemState]) -> Dict[str, BANTStatus]:
    out: Dict[str, BANTStatus] = {
        "budget": "unknown",
        "authority": "unknown",
        "need": "unknown",
        "timeline": "unknown",
    }
    for it in items:
        if it.id not in out:
            continue
        if it.status == "confirmed":
            out[it.id] = "confirmed"  # type: ignore[literal-required]
        elif it.status == "partial" and out[it.id] == "unknown":  # type: ignore[literal-required]
            out[it.id] = "partial"  # type: ignore[literal-required]
    return out


def _compute_coverage(items: List[ChecklistItemState]) -> Tuple[float, float]:
    bant_items = [i for i in items if i.tier == "bant" and i.status != "not_applicable"]
    all_items = [i for i in items if i.status != "not_applicable"]
    if not bant_items:
        return 0.0, 0.0

    def score(item: ChecklistItemState) -> float:
        if item.status == "confirmed":
            return 1.0
        if item.status == "partial":
            return 0.5
        return 0.0

    bant_cov = sum(score(i) for i in bant_items) / len(bant_items)
    all_cov = sum(score(i) for i in all_items) / len(all_items) if all_items else 0.0
    return all_cov, bant_cov


def _open_gaps(items: List[ChecklistItemState]) -> List[str]:
    gaps: List[str] = []
    for it in items:
        if it.tier == "bant" and it.status in ("pending", "partial"):
            gaps.append(it.id)
        elif it.id == "next_step" and it.status == "pending":
            gaps.append(it.id)
    return gaps


def initial_checklist_state(
    call_id: str,
    seed_bant: Optional[Dict[str, str]] = None,
    must_ask_questions: Optional[List[str]] = None,
) -> DiscoveryChecklistState:
    items: List[ChecklistItemState] = []
    for item_id in BANT_ITEM_IDS:
        seed = (seed_bant or {}).get(item_id, "unknown")
        status = _bant_status_to_checklist(seed if seed in ("confirmed", "partial", "unknown") else "unknown")  # type: ignore[arg-type]
        items.append(
            ChecklistItemState(
                id=item_id,
                label=ITEM_LABELS[item_id],
                tier="bant",
                status=status,
                suggested_question=DEFAULT_PLAYBOOK[item_id],
            )
        )
    for item_id in SECONDARY_ITEM_IDS:
        items.append(
            ChecklistItemState(
                id=item_id,
                label=ITEM_LABELS[item_id],
                tier="secondary",
                status="pending",
                suggested_question=DEFAULT_PLAYBOOK[item_id],
            )
        )

    if must_ask_questions:
        for q in must_ask_questions[:5]:
            for it in items:
                if it.status == "pending" and q.lower()[:20] in it.suggested_question.lower():
                    it.suggested_question = q[:200]
                    break

    state = DiscoveryChecklistState(
        call_id=call_id,
        coverage=0.0,
        bant_coverage=0.0,
        bant=_checklist_to_bant(items),
        items=items,
    )
    state.coverage, state.bant_coverage = _compute_coverage(items)
    state.open_gaps = _open_gaps(items)
    return state


def _unique_join(values: List[str], *, limit: int = 4) -> str:
    seen: set[str] = set()
    out: List[str] = []
    for value in values:
        cleaned = re.sub(r"\s+", " ", value).strip(" ,.;:-")
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
        if len(out) >= limit:
            break
    return " | ".join(out)


_MONEY_RE = re.compile(
    r"(?:[$€£]\s?\d[\d,.]*(?:\s?(?:k|m|b|thousand|million|billion))?"
    r"|\b\d+(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)\b)",
    re.I,
)
_MONEY_RANGE_RE = re.compile(
    rf"{_MONEY_RE.pattern}\s*(?:-|–|—|to|through|and)\s*{_MONEY_RE.pattern}",
    re.I,
)
_WORD_NUMBER_VALUES = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
_WORD_SCALE_VALUES = {"thousand": 1_000, "k": 1_000, "million": 1_000_000, "billion": 1_000_000_000}
_WORD_NUMBER_TOKEN_SOURCE = (
    r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|"
    r"thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|"
    r"thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|"
    r"million|billion|k|and)"
)
_WORD_MONEY_AMOUNT_SOURCE = rf"{_WORD_NUMBER_TOKEN_SOURCE}(?:[\s-]+{_WORD_NUMBER_TOKEN_SOURCE}){{0,10}}"
_WORD_MONEY_RE = re.compile(rf"\b{_WORD_MONEY_AMOUNT_SOURCE}\b", re.I)
_WORD_MONEY_RANGE_RE = re.compile(
    rf"\b(?P<low>{_WORD_MONEY_AMOUNT_SOURCE})\s*(?:to|through|[-–—])\s*(?P<high>{_WORD_MONEY_AMOUNT_SOURCE})\b",
    re.I,
)
_AUTHORITY_RE = re.compile(
    r"\b(?:decision maker|economic buyer|budget owner|final approver|signatory|"
    r"cfo|ceo|cto|cio|coo|cpo|vp(?:\s+of\s+\w+)?|director(?:\s+of\s+\w+)?|"
    r"head of\s+\w+|board|steering committee|approval committee)\b",
    re.I,
)
_AUTHORITY_APPROVAL_ENTITY_RE = re.compile(r"\b(?:procurement|finance|legal)\b", re.I)
_AUTHORITY_APPROVAL_ACTION_RE = re.compile(r"\b(?:approv\w*|sign[ -]?off|review|bless\w*)\b", re.I)
_SELF_AUTHORITY_RE = re.compile(
    r"\b(?:i decide|my call|i approve|i own(?:s)? the decision|i am the decision maker)\b",
    re.I,
)
_MONTH_PATTERN = (
    r"January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|"
    r"August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec"
)
_TIMELINE_NUMBER_PATTERN = (
    r"\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|"
    r"twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|"
    r"twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety"
)
_TIMELINE_DURATION_PATTERN = (
    rf"(?:{_TIMELINE_NUMBER_PATTERN})\s+"
    r"(?:business\s+days?|days?|weeks?|months?|quarters?)"
)
_TIMELINE_RE = re.compile(
    r"\b(?:Q[1-4](?:\s+(?:pilot|kickoff|go-live|production|launch|rollout|readout|approval)){0,3}"
    rf"|(?:project\s+)?ETA\s*(?:is|of|for|:)?\s*(?:about|around|roughly)?\s*{_TIMELINE_DURATION_PATTERN}(?:\s+(?:from|after|before)\s+[A-Za-z][\w-]*)?"
    rf"|(?:in|within)\s+{_TIMELINE_DURATION_PATTERN}"
    rf"|{_TIMELINE_DURATION_PATTERN}\s+(?:from|after|before)\s+[A-Za-z][\w-]*"
    r"|(?:pilot|production|go-live|go live|launch|rollout|kickoff|readout)\s+"
    rf"(?:by|in|before|after)\s+(?:the\s+)?(?:Q[1-4]|{_MONTH_PATTERN}|next quarter|this quarter|next month|this month)"
    rf"|(?:by|before|after)\s+(?:the\s+)?(?:Q[1-4]|{_MONTH_PATTERN}|next quarter|this quarter|next month|this month)"
    rf"|(?:complete|delivery|delivered|ship|implementation)\s+(?:by|in|before|after|within)\s+(?:the\s+)?(?:Q[1-4]|{_MONTH_PATTERN}|next quarter|this quarter|next month|this month|{_TIMELINE_DURATION_PATTERN})"
    r"|(?:this|next)\s+(?:week|month|quarter|year)"
    rf"|(?:\d{{1,2}}\s+)?(?:{_MONTH_PATTERN})\b)",
    re.I,
)
_TIMELINE_MILESTONE_RE = re.compile(
    r"\bQ[1-4](?:\s+(?:pilot|kickoff|go-live|production|launch|rollout|readout|approval)){1,3}\b",
    re.I,
)
_NEED_RE = re.compile(
    r"\b(?:pain|problem|challenge|struggling|bottleneck|friction|gap|manual|broken|"
    r"nightmare|limitation|need to|need a|need an|must have|critical|priority)\b",
    re.I,
)
_APPROVAL_NEED_RE = re.compile(r"\bneed(?:s)?\s+to\s+approv(?:e|al)\b", re.I)
_PAIN_NEED_RE = re.compile(
    r"\b(?:pain|problem|challenge|struggling|bottleneck|friction|gap|manual|broken|"
    r"nightmare|limitation|must have|critical|priority|business case)\b",
    re.I,
)


def _extract_authority_values(text: str) -> str:
    values = [m.group(0) for m in _AUTHORITY_RE.finditer(text)]
    for match in _AUTHORITY_APPROVAL_ENTITY_RE.finditer(text):
        window = text[max(0, match.start() - 80) : min(len(text), match.end() + 80)]
        if _AUTHORITY_APPROVAL_ACTION_RE.search(window):
            values.append(match.group(0))
    values.extend(m.group(0) for m in _SELF_AUTHORITY_RE.finditer(text))
    return _unique_join(values, limit=4)


def _extract_bant_value(item_id: str, text: str, snippet: str) -> str:
    if item_id == "budget":
        ranges = [m.group(0) for m in _MONEY_RANGE_RE.finditer(text)]
        amounts = [m.group(0) for m in _MONEY_RE.finditer(text)]
        word_ranges, range_spans = _extract_word_money_ranges(text)
        word_amounts = _extract_word_money_amounts(text, skip_spans=range_spans)
        value = _unique_join([*(ranges or amounts), *word_ranges, *word_amounts], limit=3)
        if value:
            return value
    elif item_id == "authority":
        value = _extract_authority_values(text)
        if value:
            return value
        return ""
    elif item_id == "timeline":
        milestones = [m.group(0) for m in _TIMELINE_MILESTONE_RE.finditer(text)]
        milestone_quarters = {
            quarter.upper()
            for value in milestones
            for quarter in re.findall(r"\bQ[1-4]\b", value, re.I)
        }
        generic = []
        for match in _TIMELINE_RE.finditer(text):
            value = match.group(0)
            quarters = {q.upper() for q in re.findall(r"\bQ[1-4]\b", value, re.I)}
            if quarters and quarters.issubset(milestone_quarters) and value not in milestones:
                continue
            generic.append(value)
        value = _unique_join(
            [*milestones, *generic],
            limit=4,
        )
        if value:
            return value
    elif item_id == "need":
        if _NEED_RE.search(text):
            return snippet
    return snippet


def _parse_word_money_amount(phrase: str) -> Optional[Tuple[int, Optional[int]]]:
    tokens = [t.lower() for t in re.findall(_WORD_NUMBER_TOKEN_SOURCE, phrase, re.I)]
    if not tokens:
        return None

    total = 0
    current = 0
    major_scale: Optional[int] = None
    saw_number = False

    for token in tokens:
        if token == "and":
            continue
        if token in _WORD_NUMBER_VALUES:
            current += _WORD_NUMBER_VALUES[token]
            saw_number = True
        elif token == "hundred":
            current = (current or 1) * 100
            saw_number = True
        elif token in _WORD_SCALE_VALUES:
            scale = _WORD_SCALE_VALUES[token]
            total += (current or 1) * scale
            current = 0
            major_scale = scale
            saw_number = True

    value = total + current
    if not saw_number or value <= 0:
        return None
    return value, major_scale


def _format_compact_money(value: int) -> str:
    for scale, suffix in ((1_000_000_000, "B"), (1_000_000, "M"), (1_000, "K")):
        if abs(value) >= scale:
            scaled = value / scale
            if value % scale == 0:
                return f"${int(scaled)}{suffix}"
            return f"${scaled:.1f}".rstrip("0").rstrip(".") + suffix
    return f"${value:,}"


def _format_word_money_range(low_phrase: str, high_phrase: str) -> Optional[str]:
    low = _parse_word_money_amount(low_phrase)
    high = _parse_word_money_amount(high_phrase)
    if not low or not high:
        return None

    low_value, low_scale = low
    high_value, high_scale = high
    if low_scale is None and high_scale and low_value < high_scale:
        low_value *= high_scale
    if high_scale is None and low_scale and high_value < low_scale:
        high_value *= low_scale
    return f"{_format_compact_money(low_value)} to {_format_compact_money(high_value)}"


def _extract_word_money_ranges(text: str) -> Tuple[List[str], List[Tuple[int, int]]]:
    ranges: List[str] = []
    spans: List[Tuple[int, int]] = []
    for match in _WORD_MONEY_RANGE_RE.finditer(text):
        formatted = _format_word_money_range(match.group("low"), match.group("high"))
        if formatted:
            ranges.append(formatted)
            spans.append(match.span())
    return ranges, spans


def _span_overlaps(span: Tuple[int, int], skip_spans: List[Tuple[int, int]]) -> bool:
    start, end = span
    return any(start < skip_end and end > skip_start for skip_start, skip_end in skip_spans)


def _extract_word_money_amounts(text: str, *, skip_spans: List[Tuple[int, int]]) -> List[str]:
    amounts: List[str] = []
    for match in _WORD_MONEY_RE.finditer(text):
        if _span_overlaps(match.span(), skip_spans):
            continue
        phrase = match.group(0)
        parsed = _parse_word_money_amount(phrase)
        if not parsed:
            continue
        value, scale = parsed
        if scale is None and "hundred" not in phrase.lower():
            continue
        amounts.append(_format_compact_money(value))
    return amounts


def _signal_type_to_item(signal_type: Optional[str]) -> Optional[str]:
    mapping = {
        "budget_signal": "budget",
        "authority_signal": "authority",
        "decision_maker_signal": "authority",
        "timeline_signal": "timeline",
        "need_signal": "need",
        "pain_signal": "need",
    }
    return mapping.get((signal_type or "").strip())


def _confidence_for_evidence(item_id: str, value: str, sentiment: Optional[str]) -> float:
    if item_id in ("budget", "authority", "timeline") and value:
        return 0.86
    if item_id == "need" and sentiment == "negative":
        return 0.84
    return 0.75


def _apply_signals(
    text: str,
    items: List[ChecklistItemState],
    snippet: str,
    *,
    transcript_offset_seconds: Optional[float] = None,
    sentiment: Optional[str] = None,
    speaker_role: Optional[str] = None,
    signal_type: Optional[str] = None,
) -> List[str]:
    """Returns list of item ids touched by this segment (status or new evidence)."""
    lower = text.lower()
    changed: List[str] = []
    matched_statuses: Dict[str, ChecklistItemStatus] = {}

    money_hit = bool(
        re.search(
            r"\$[\d,.]+[kmb]?|\b\d+(?:\.\d+)?\s*(?:million|billion|thousand|k|m|b)\b",
            lower,
        )
    )
    signal_item_id = _signal_type_to_item(signal_type)
    for item_id, keywords, tier_status in SIGNAL_RULES:
        matched = any(kw in lower for kw in keywords)
        if item_id == "budget" and money_hit:
            matched = True
        if item_id == "need" and sentiment == "negative" and _NEED_RE.search(text):
            matched = True
        if item_id == "need" and _APPROVAL_NEED_RE.search(text) and not _PAIN_NEED_RE.search(text):
            matched = False
        if not matched:
            continue
        current = matched_statuses.get(item_id, "pending")
        matched_statuses[item_id] = _merge_status(current, tier_status)

    if signal_item_id and signal_item_id not in matched_statuses:
        matched_statuses[signal_item_id] = "partial"

    for item_id, tier_status in matched_statuses.items():
        for it in items:
            if it.id != item_id:
                continue
            new_status = _merge_status(it.status, tier_status)
            value = _extract_bant_value(item_id, text, snippet)
            if item_id == "authority" and not value:
                continue
            status_changed = new_status != it.status
            if status_changed:
                it.status = new_status
            it.evidence.append(
                ChecklistEvidence(
                    snippet=snippet[:200],
                    transcript_offset_seconds=transcript_offset_seconds,
                    confidence=_confidence_for_evidence(item_id, value, sentiment),
                    value=value[:120],
                    sentiment=sentiment,
                    speaker_role=speaker_role,
                    signal_type=signal_type,
                )
            )
            if len(it.evidence) > 5:
                it.evidence = it.evidence[-5:]
            if item_id not in changed:
                changed.append(item_id)
            break
    return changed


def build_next_actions(checklist: Dict[str, Any], *, intent_label: Optional[str] = None) -> List[str]:
    """Actionable AE prompts from open BANT gaps and live checklist evidence."""
    items = {it["id"]: it for it in (checklist.get("items") or []) if isinstance(it, dict)}
    open_gaps = list(checklist.get("openGaps") or [])
    actions: List[str] = []

    def evidence_snippet(item_id: str) -> str:
        it = items.get(item_id) or {}
        ev = (it.get("evidence") or [{}])[0] if it.get("evidence") else {}
        return str(ev.get("snippet") or "")[:80]

    gap_prompts = {
        "budget": (
            "Clarify budget range and who signs off — ask for approved envelope vs exploratory.",
            "Probe budget — customer mentioned money on the call; confirm range and approval path.",
        ),
        "authority": (
            "Identify economic buyer and signatory — map who must approve before procurement.",
            "Confirm decision authority — ask who else must be in the room for a yes.",
        ),
        "need": (
            "Quantify the core pain — ask what metric moves first if this problem is solved.",
            "Dig into urgency — tie the stated pain to business impact and priority.",
        ),
        "timeline": (
            "Pin target go-live and decision deadline — ask what must be true before the board says yes.",
            "Confirm timeline — customer gave timing cues; validate pilot vs production dates.",
        ),
        "next_step": (
            "Lock a concrete next step — propose calendar hold with the right attendees.",
        ),
    }

    for gap in open_gaps:
        if gap not in gap_prompts:
            continue
        snippet = evidence_snippet(gap)
        if snippet and gap in ("budget", "timeline", "authority"):
            actions.append(f'{gap_prompts[gap][1]} Quote: "{snippet}…"')
        else:
            actions.append(gap_prompts[gap][0])

    bant = checklist.get("bant") or {}
    confirmed = [k for k in ("budget", "authority", "need", "timeline") if bant.get(k) == "confirmed"]
    if len(confirmed) >= 3 and "next_step" not in open_gaps:
        actions.append("Strong BANT coverage — propose pilot scope, proposal timeline, and executive readout.")

    if intent_label in ("commercial_discovery", "timeline_planning"):
        actions.append("Align pitch to commercial + timeline signals — reference proposal path and dates.")

    if not actions:
        actions.append("Continue discovery — open questions on budget, authority, need, and timeline.")

    seen: set[str] = set()
    unique: List[str] = []
    for a in actions:
        if a in seen:
            continue
        seen.add(a)
        unique.append(a)
    return unique[:4]


def update_checklist_from_segment(
    state: DiscoveryChecklistState,
    text: str,
    *,
    elapsed_seconds: Optional[int] = None,
    transcript_offset_seconds: Optional[float] = None,
    sentiment: Optional[str] = None,
    speaker_role: Optional[str] = None,
    signal_type: Optional[str] = None,
) -> Tuple[DiscoveryChecklistState, List[str], List[BANTDimension]]:
    """Update checklist from a transcript segment. Returns (state, changed_ids, new_bant_dimensions)."""
    state = deepcopy(state)
    if elapsed_seconds is not None:
        state.elapsed_seconds = elapsed_seconds

    snippet = text.strip()[:200]
    if not snippet:
        return state, [], []

    changed = _apply_signals(
        text,
        state.items,
        snippet,
        transcript_offset_seconds=(
            transcript_offset_seconds
            if transcript_offset_seconds is not None
            else float(elapsed_seconds) if elapsed_seconds is not None else None
        ),
        sentiment=sentiment,
        speaker_role=speaker_role,
        signal_type=signal_type,
    )
    state.bant = _checklist_to_bant(state.items)
    state.coverage, state.bant_coverage = _compute_coverage(state.items)
    state.open_gaps = _open_gaps(state.items)

    new_dims: List[BANTDimension] = []
    for item_id in changed:
        if item_id in BANT_ITEM_IDS:
            new_dims.append(item_id)  # type: ignore[arg-type]

    return state, changed, new_dims


def score_bant_progression(
    before: Dict[str, bool],
    after: Dict[str, bool],
) -> BantProgressionResult:
    """Score boolean BANT coverage before/after (coaching agent)."""
    dims = ("budget", "authority", "need", "timeline")
    before_status: Dict[str, BANTStatus] = {d: ("confirmed" if before.get(d) else "unknown") for d in dims}
    after_status: Dict[str, BANTStatus] = {d: ("confirmed" if after.get(d) else "unknown") for d in dims}
    delta = sum(1 for d in dims if not before.get(d) and after.get(d))
    qualifying = all(after.get(d) for d in dims)
    return BantProgressionResult(
        before=before_status,
        after=after_status,
        delta=delta,
        is_qualifying=qualifying,
    )


def score_bant_from_checklist(state: DiscoveryChecklistState) -> BantProgressionResult:
    after = state.bant
    before = {k: "unknown" for k in after}
    delta = sum(1 for k, v in after.items() if v == "confirmed")
    qualifying = all(after.get(d) == "confirmed" for d in BANT_ITEM_IDS)
    return BantProgressionResult(before=before, after=after, delta=delta, is_qualifying=qualifying)


@dataclass
class NudgeDecision:
    item_id: str
    message: str
    clarify: bool


def should_nudge(
    state: DiscoveryChecklistState,
    *,
    thresholds_seconds: Optional[Dict[str, int]] = None,
    max_nudges_per_window: int = 3,
    window_seconds: int = 300,
) -> Optional[NudgeDecision]:
    thresholds = thresholds_seconds or DEFAULT_NUDGE_THRESHOLDS_SECONDS
    now = float(state.elapsed_seconds)

    recent = [t for t in state.nudge_history.values() if now - t < window_seconds]
    if len(recent) >= max_nudges_per_window:
        return None

    bant_confirmed = all(state.bant.get(d) == "confirmed" for d in BANT_ITEM_IDS)

    candidates: List[Tuple[int, ChecklistItemState]] = []
    for it in state.items:
        if it.status in ("confirmed", "not_applicable"):
            continue
        threshold = thresholds.get(it.id)
        if threshold is None and it.tier == "secondary":
            continue
        if threshold is None:
            threshold = 35 * 60
        last = state.nudge_history.get(it.id, 0.0)
        if now - last < window_seconds:
            continue
        if it.status == "pending" and now >= threshold:
            candidates.append((threshold, it))
        elif it.status == "partial" and now >= threshold * 0.8:
            candidates.append((int(threshold * 0.8), it))

    if bant_confirmed:
        for it in state.items:
            if it.id == "next_step" and it.status == "pending":
                last = state.nudge_history.get(it.id, 0.0)
                if now - last >= window_seconds:
                    return NudgeDecision(
                        item_id=it.id,
                        message=_truncate(it.suggested_question),
                        clarify=False,
                    )

    if not candidates:
        return None

    candidates.sort(key=lambda x: -x[0])
    it = candidates[0][1]
    clarify = it.status == "partial"
    msg = it.suggested_question
    if clarify:
        msg = f"Clarify {it.label.lower()}: {msg}"
    return NudgeDecision(item_id=it.id, message=_truncate(msg), clarify=clarify)


def _truncate(text: str, max_words: int = 25) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "…"


def record_nudge(state: DiscoveryChecklistState, item_id: str) -> DiscoveryChecklistState:
    state = deepcopy(state)
    state.nudge_history[item_id] = float(state.elapsed_seconds)
    return state


def checklist_from_dict(data: Dict[str, Any]) -> DiscoveryChecklistState:
    """Rehydrate session state from persisted JSON."""
    items: List[ChecklistItemState] = []
    for raw in data.get("items") or []:
        evidence = [
            ChecklistEvidence(
                snippet=e.get("snippet", ""),
                transcript_offset_seconds=e.get("transcriptOffsetSeconds"),
                confidence=float(e.get("confidence", 0.7)),
                value=e.get("value", ""),
                sentiment=e.get("sentiment"),
                speaker_role=e.get("speakerRole"),
                signal_type=e.get("signalType"),
            )
            for e in raw.get("evidence") or []
        ]
        items.append(
            ChecklistItemState(
                id=raw["id"],
                label=raw.get("label", ITEM_LABELS.get(raw["id"], raw["id"])),
                tier=raw.get("tier", "bant" if raw["id"] in BANT_ITEM_IDS else "secondary"),
                status=raw.get("status", "pending"),
                suggested_question=raw.get("suggestedQuestion", DEFAULT_PLAYBOOK.get(raw["id"], "")),
                evidence=evidence,
            )
        )
    bant = data.get("bant") or _checklist_to_bant(items)
    state = DiscoveryChecklistState(
        call_id=data.get("callId", ""),
        coverage=float(data.get("coverage", 0)),
        bant_coverage=float(data.get("bantCoverage", 0)),
        bant=bant,
        items=items,
        elapsed_seconds=int(data.get("elapsedSeconds", 0)),
        open_gaps=list(data.get("openGaps") or []),
        nudge_history=dict(data.get("nudgeHistory") or {}),
    )
    return state
