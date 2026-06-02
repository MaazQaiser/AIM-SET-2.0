/**
 * Client-side live-call demo — drives the Zustand store when the API / WebSocket
 * path is unavailable (e.g. DEMO_TRANSCRIPT_REPLAY=false or backend offline).
 */

import type { DemoTranscriptLine } from "@/lib/demo-live-transcript";
import { useLiveCall } from "@/stores/use-live-call";
import type { BantSignal, ChecklistItem, DiscoveryChecklistState } from "@dc-copilot/types";
import type {
  IntentSnapshot,
  KeywordStats,
  NudgePayload,
  ObjectionPayload,
  TranscriptEvent,
  UnansweredQuestionPayload,
} from "@/types";

const DEMO_KEYWORDS = [
  "franchise",
  "platform",
  "pilot",
  "budget",
  "compliance",
  "AI",
  "Q3",
  "spreadsheet",
  "integration",
  "multi-tenant",
];

function extractKeywords(text: string, existing: KeywordStats | null): KeywordStats {
  const lower = text.toLowerCase();
  const counts = new Map<string, number>();
  for (const term of existing?.global_top ?? []) {
    counts.set(term.term.toLowerCase(), term.count);
  }
  for (const kw of DEMO_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      const key = kw.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const global_top = [...counts.entries()]
    .map(([term, count]) => ({
      term: term.charAt(0).toUpperCase() + term.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return { global_top, by_speaker: existing?.by_speaker ?? {} };
}

function cloneChecklist(
  base: DiscoveryChecklistState | null,
  callId: string
): DiscoveryChecklistState {
  if (base) {
    return {
      ...base,
      items: base.items.map((i) => ({ ...i, evidence: [...(i.evidence ?? [])] })),
      bant: { ...base.bant },
      openGaps: [...base.openGaps],
    };
  }
  const items: ChecklistItem[] = [
    { id: "budget", label: "Budget", tier: "bant", status: "pending", evidence: [] },
    { id: "authority", label: "Authority", tier: "bant", status: "pending", evidence: [] },
    { id: "need", label: "Need", tier: "bant", status: "pending", evidence: [] },
    { id: "timeline", label: "Timeline", tier: "bant", status: "pending", evidence: [] },
    { id: "decision_process", label: "Decision process", tier: "secondary", status: "pending", evidence: [] },
    { id: "competition", label: "Competition", tier: "secondary", status: "pending", evidence: [] },
    { id: "next_step", label: "Next step", tier: "secondary", status: "pending", evidence: [] },
  ];
  return {
    callId,
    coverage: 0,
    bantCoverage: 0,
    bant: { budget: "unknown", authority: "unknown", need: "unknown", timeline: "unknown" },
    items,
    elapsedSeconds: 0,
    openGaps: ["budget", "authority", "need", "timeline"],
    updatedAt: new Date().toISOString(),
  };
}

function scoreChecklist(state: DiscoveryChecklistState): DiscoveryChecklistState {
  const score = (s: ChecklistItem["status"]) =>
    s === "confirmed" ? 1 : s === "partial" ? 0.5 : 0;
  const bantItems = state.items.filter((i) => i.tier === "bant");
  const bantCoverage = bantItems.length
    ? bantItems.reduce((a, i) => a + score(i.status), 0) / bantItems.length
    : 0;
  const coverage = state.items.length
    ? state.items.reduce((a, i) => a + score(i.status), 0) / state.items.length
    : 0;
  const openGaps = state.items
    .filter(
      (i) =>
        (i.tier === "bant" && i.status !== "confirmed") ||
        (i.id === "decision_process" && i.status === "pending") ||
        (i.id === "authority" && i.status !== "confirmed")
    )
    .map((i) => i.id);
  return {
    ...state,
    coverage,
    bantCoverage,
    openGaps,
    updatedAt: new Date().toISOString(),
  };
}

function patchItem(
  state: DiscoveryChecklistState,
  id: ChecklistItem["id"],
  status: ChecklistItem["status"],
  snippet?: string
): DiscoveryChecklistState {
  const bantKey = id as keyof DiscoveryChecklistState["bant"];
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    const evidence = snippet
      ? [{ snippet, confidence: 0.85, transcriptOffsetSeconds: state.elapsedSeconds }]
      : item.evidence;
    return { ...item, status, evidence };
  });
  const bant =
    id in state.bant
      ? {
          ...state.bant,
          [bantKey]:
            status === "confirmed"
              ? "confirmed"
              : status === "partial"
                ? "partial"
                : "unknown",
        }
      : state.bant;
  return scoreChecklist({ ...state, items, bant });
}

function lineToTranscriptEvent(
  callId: string,
  line: DemoTranscriptLine,
  index: number
): TranscriptEvent {
  return {
    id: `demo-${callId}-${index}`,
    speakerId: line.speakerId,
    speakerName: line.speakerName,
    speakerRole: line.speakerRole,
    text: line.text,
    timestamp: line.offsetSeconds,
    keywords: [],
    sentiment:
      line.speakerRole === "customer"
        ? line.text.match(/nightmare|broken|zero|bottleneck/i)
          ? "negative"
          : line.text.match(/exactly|appreciate|great|first answer/i)
            ? "positive"
            : "neutral"
        : "neutral",
  };
}

function addBant(store: ReturnType<typeof useLiveCall.getState>, signal: Omit<BantSignal, "id">) {
  store.addBantSignal({
    ...signal,
    id: `demo-bant-${signal.dimension}-${signal.timestamp}`,
  });
}

function addNudge(store: ReturnType<typeof useLiveCall.getState>, nudge: Omit<NudgePayload, "id">) {
  store.addNudge({
    ...nudge,
    id: `demo-nudge-${nudge.timestamp}-${crypto.randomUUID().slice(0, 8)}`,
  });
}

/** Apply scripted live-call side effects for one demo transcript line (no network). */
export function applyClientDemoSegment(
  callId: string,
  lineIndex: number,
  line: DemoTranscriptLine
) {
  const store = useLiveCall.getState();
  store.setConnected(true);

  const event = lineToTranscriptEvent(callId, line, lineIndex);
  store.appendTranscriptEvent(event);

  const stats = extractKeywords(line.text, store.keywordStats);
  store.applyKeywordStats(stats);

  let checklist = cloneChecklist(store.checklistState, callId);
  checklist.elapsedSeconds = line.offsetSeconds;

  switch (lineIndex) {
    case 0:
      store.updateSentiment(0.25, 0.15, null);
      break;
    case 1:
      store.applyIntentUpdate({
        intent: {
          label: "commercial_discovery",
          display: "Commercial discovery · proposal requested",
          confidence: 0.82,
          evidence: line.text.slice(0, 120),
        },
        focus_areas: ["AI-native platform", "franchise operations", "formal proposal"],
        pains: [],
        top_keywords: stats.global_top.slice(0, 5),
        next_actions: ["Confirm proposal scope and board timeline before end of call."],
      } satisfies IntentSnapshot);
      addNudge(store, {
        message: "Customer expects a formal proposal after this call — confirm deliverables and date.",
        citation: { id: "demo-1", title: "Transcript", type: "transcript", excerpt: line.text },
        role: "ae",
        timestamp: line.offsetSeconds,
        source: "live-call",
      });
      break;
    case 3:
      store.applyIntentUpdate({
        intent: {
          label: "pain_discovery",
          display: "Pain discovery · operational fragmentation",
          confidence: 0.78,
        },
        focus_areas: ["spreadsheet chaos", "POS integrations", "unit performance visibility"],
        pains: [
          {
            id: "pain-ops-fragmentation",
            text: "Operators live in spreadsheets with no real-time unit performance view",
            source: "emergent",
            confidence: 0.88,
            timestamp: line.offsetSeconds,
            evidence: line.text,
          },
        ],
        top_keywords: stats.global_top.slice(0, 5),
        next_actions: ["Quantify cost of manual ops and compliance delays."],
      });
      checklist = patchItem(checklist, "need", "confirmed", line.text);
      addBant(store, {
        dimension: "need",
        label: "Cloud migration / ops modernization need confirmed",
        timestamp: line.offsetSeconds,
      });
      break;
    case 4:
      store.applyIntentUpdate({
        intent: {
          label: "pain_discovery",
          display: "Pain discovery · compliance bottleneck",
          confidence: 0.8,
        },
        focus_areas: ["brand-standard audits", "regional expansion", "compliance"],
        pains: [
          ...(store.intentSnapshot?.pains ?? []),
          {
            id: "pain-compliance-audits",
            text: "Manual brand-standard audits block next regional expansion wave",
            source: "emergent",
            confidence: 0.86,
            timestamp: line.offsetSeconds,
            evidence: line.text,
          },
        ],
        top_keywords: stats.global_top.slice(0, 5),
        next_actions: ["Ask how many locations fail audit per quarter."],
      });
      break;
    case 5:
      checklist = patchItem(checklist, "budget", "confirmed", line.text);
      addBant(store, {
        dimension: "budget",
        label: "$450K–$600K year-one envelope · board approval in May",
        timestamp: line.offsetSeconds,
      });
      addNudge(store, {
        message: "Budget band stated on-record — ask who controls final sign-off beyond the board.",
        citation: { id: "demo-budget", title: "BANT gap", type: "transcript", excerpt: line.text },
        role: "ae",
        timestamp: line.offsetSeconds,
        source: "discovery-checklist",
        checklistItemId: "authority",
      });
      break;
    case 6:
      checklist = patchItem(checklist, "timeline", "confirmed", line.text);
      addBant(store, {
        dimension: "timeline",
        label: "Q3 pilot · Q1 production go-live",
        timestamp: line.offsetSeconds,
      });
      break;
    case 7: {
      const objection: ObjectionPayload = {
        id: `demo-objection-${lineIndex}`,
        objection_text: "Evaluating build-vs-buy with internal orchestration prototype",
        counter_points: [
          "Production agent fabric vs internal prototype scope",
          "Franchisee permission boundaries and POS integrations",
        ],
        suggested_action: "Differentiate time-to-value and operational risk",
        timestamp: line.offsetSeconds,
      };
      store.addObjection(objection);
      checklist = patchItem(checklist, "competition", "partial", line.text);
      addNudge(store, {
        message: "Build-vs-buy objection — differentiate time-to-value and franchisee permission model.",
        citation: { id: "demo-comp", title: "Objection", type: "transcript", excerpt: line.text },
        role: "ae",
        timestamp: line.offsetSeconds,
        source: "live-call",
      });
      break;
    }
    case 9:
      store.updateSentiment(0.35, 0.55, {
        direction: "positive",
        from_score: 0.2,
        to_score: 0.55,
        timestamp: line.offsetSeconds,
        message: "Customer warming after technical differentiation on multi-tenant agent mesh.",
      });
      break;
    case 10:
      checklist = patchItem(checklist, "next_step", "partial", line.text);
      break;
    case 11: {
      checklist = patchItem(checklist, "authority", "partial", line.text);
      checklist = patchItem(checklist, "decision_process", "partial", line.text);
      const question: UnansweredQuestionPayload = {
        id: `demo-q-cfo-${lineIndex}`,
        text: "Who besides the CFO needs to approve budget before the Q3 pilot kickoff?",
        timestamp: line.offsetSeconds,
        asked_at_offset: line.offsetSeconds,
      };
      store.addUnansweredQuestion(question);
      addNudge(store, {
        message: "CFO readout mentioned — map full decision committee and procurement steps.",
        citation: { id: "demo-auth", title: "BANT gap", type: "transcript", excerpt: line.text },
        role: "ae",
        timestamp: line.offsetSeconds,
        source: "discovery-checklist",
        checklistItemId: "authority",
      });
      break;
    }
    default:
      break;
  }

  if (lineIndex >= 3) {
    store.applyChecklistUpdate(checklist);
  }

  if (line.speakerRole === "customer" && lineIndex > 0) {
    const prev = store.sentimentCustomer;
    const next = lineIndex >= 9 ? 0.55 : lineIndex >= 5 ? 0.35 : 0.25;
    if (next !== prev) {
      store.updateSentiment(store.sentimentAE, next, store.sentimentShift);
    }
  }
}

export function transcriptEventFromDemoLine(
  callId: string,
  line: DemoTranscriptLine,
  index: number
): TranscriptEvent {
  return lineToTranscriptEvent(callId, line, index);
}

/** Apply analysis fields returned by POST demo-segment (when WebSocket is down). */
export function applyApiDemoResult(data: Record<string, unknown>) {
  const store = useLiveCall.getState();
  if (data.checklist && typeof data.checklist === "object") {
    store.applyChecklistUpdate(data.checklist as DiscoveryChecklistState);
  }
  if (data.intent && typeof data.intent === "object") {
    store.applyIntentUpdate(data.intent as IntentSnapshot);
  }
  const messages = data.ws_messages;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (!msg || typeof msg !== "object") continue;
      const typed = msg as { type?: string; payload?: unknown };
      switch (typed.type) {
        case "nudge":
          store.addNudge(typed.payload as NudgePayload);
          break;
        case "checklist_update":
          if (typed.payload && typeof typed.payload === "object") {
            store.applyChecklistUpdate(typed.payload as DiscoveryChecklistState);
          }
          break;
        case "intent_update":
          if (typed.payload && typeof typed.payload === "object") {
            store.applyIntentUpdate(typed.payload as IntentSnapshot);
          }
          break;
        default:
          break;
      }
    }
  }
}
