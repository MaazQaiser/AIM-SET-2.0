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
    ("budget", ["budget", "pricing", "cost", "spend", "investment", "approved budget", "dollar", "price", "afford", "expensive", "cheap", "limited budget", "money", "funding", "financial"], "partial"),
    ("budget", ["budget approved", "allocated", "signed off", "funding approved", "set aside", "earmarked"], "confirmed"),
    ("authority", ["decision maker", "economic buyer", "sign off", "cio", "cto", "vp ", "director", "board", "manager", "head of", "lead", "chief", "executive", "owner"], "partial"),
    ("authority", ["reports to", "final say", "signatory", "approves", "i decide", "my call", "i approve"], "confirmed"),
    ("need", ["pain", "problem", "challenge", "struggling", "need to", "priority", "impact", "pain point", "overcome", "solution", "looking for", "looking forward", "require", "want to", "wish we", "gap", "issue", "bottleneck", "friction", "limitation", "automat"], "partial"),
    ("need", ["must have", "critical", "urgent need", "business case", "top priority", "deal breaker", "non-negotiable"], "confirmed"),
    ("timeline", ["timeline", "deadline", "go-live", "launch", "q1", "q2", "q3", "q4", "by end of", "this quarter", "next quarter", "this year", "next month", "asap", "soon", "urgent", "immediately"], "partial"),
    ("timeline", ["board meeting", "decision by", "kick off", "start date", "go live date", "target date"], "confirmed"),
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


def _apply_signals(text: str, items: List[ChecklistItemState], snippet: str) -> List[str]:
    """Returns list of item ids that changed."""
    lower = text.lower()
    changed: List[str] = []
    for item_id, keywords, tier_status in SIGNAL_RULES:
        if not any(kw in lower for kw in keywords):
            continue
        for it in items:
            if it.id != item_id:
                continue
            new_status = _merge_status(it.status, tier_status)
            if new_status != it.status:
                it.status = new_status
                changed.append(item_id)
            it.evidence.append(ChecklistEvidence(snippet=snippet[:200], confidence=0.75))
            if len(it.evidence) > 5:
                it.evidence = it.evidence[-5:]
            break
    return changed


def update_checklist_from_segment(
    state: DiscoveryChecklistState,
    text: str,
    *,
    elapsed_seconds: Optional[int] = None,
    transcript_offset_seconds: Optional[float] = None,
) -> Tuple[DiscoveryChecklistState, List[str], List[BANTDimension]]:
    """Update checklist from a transcript segment. Returns (state, changed_ids, new_bant_dimensions)."""
    state = deepcopy(state)
    if elapsed_seconds is not None:
        state.elapsed_seconds = elapsed_seconds

    snippet = text.strip()[:200]
    if not snippet:
        return state, [], []

    changed = _apply_signals(text, state.items, snippet)
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
