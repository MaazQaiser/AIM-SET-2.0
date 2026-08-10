import { create } from "zustand";
import { filterKeywordStats } from "@/lib/live/keyword-filter";
import { dedupePainSignals } from "@/lib/live/pain-display";
import type {
  ChecklistItem,
  ChecklistItemStatus,
  TranscriptEvent,
  NudgePayload,
  CustomerSentimentCue,
  IntentSnapshot,
  KeywordStats,
  ObjectionPayload,
  SalesRepToneCue,
  SentimentSignal,
  SentimentShift,
  SurfacedKbAsset,
  SuggestionLogEntry,
  UnansweredQuestionPayload,
} from "@/types";
import type { BantSignal, BANTStatus, DiscoveryChecklistState } from "@dc-copilot/types";

interface LiveCallState {
  callId: string | null;
  isConnected: boolean;
  transcript: TranscriptEvent[];
  pendingNudges: NudgePayload[];
  bantSignals: BantSignal[];
  sentimentSignals: SentimentSignal[];
  elapsedSeconds: number;
  sentimentAE: number | null;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: number | null;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  intentSnapshot: IntentSnapshot | null;
  keywordStats: KeywordStats | null;
  focusAreas: string[];
  checklistState: DiscoveryChecklistState | null;
  surfacedKbAssets: SurfacedKbAsset[];
  objections: ObjectionPayload[];
  unansweredQuestions: UnansweredQuestionPayload[];
  suggestionLog: SuggestionLogEntry[];

  setCallId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  appendTranscriptEvent: (event: TranscriptEvent) => void;
  addNudge: (nudge: NudgePayload) => void;
  addBantSignal: (signal: BantSignal) => void;
  addSentimentSignal: (signal: SentimentSignal) => void;
  dismissNudge: (id: string) => void;
  acceptNudge: (id: string) => void;
  updateSentiment: (
    ae: number | null,
    customer: number | null,
    shift?: SentimentShift | null,
    salesRepTone?: SalesRepToneCue | null,
    customerSentiment?: CustomerSentimentCue | null
  ) => void;
  applyIntentUpdate: (payload: IntentSnapshot) => void;
  applyKeywordStats: (stats: KeywordStats) => void;
  applyChecklistUpdate: (state: DiscoveryChecklistState) => void;
  setSurfacedKbAssets: (assets: SurfacedKbAsset[]) => void;
  addObjection: (objection: ObjectionPayload) => void;
  addUnansweredQuestion: (q: UnansweredQuestionPayload) => void;
  appendSuggestionLog: (entry: SuggestionLogEntry) => void;
  hydrateFromStoredSession: (payload: {
    transcript: TranscriptEvent[];
    suggestionLog: SuggestionLogEntry[];
    sentimentAE: number | null;
    sentimentCustomer: number | null;
  }) => void;
  tickElapsed: () => void;
  reset: () => void;
}

const initialState = {
  callId: null,
  isConnected: false,
  transcript: [],
  pendingNudges: [],
  bantSignals: [],
  sentimentSignals: [],
  elapsedSeconds: 0,
  sentimentAE: null,
  salesRepTone: null,
  sentimentCustomer: null,
  customerSentiment: null,
  sentimentShift: null,
  intentSnapshot: null,
  keywordStats: null,
  focusAreas: [],
  checklistState: null,
  surfacedKbAssets: [],
  objections: [],
  unansweredQuestions: [],
  suggestionLog: [],
};

function stableKey(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function upsertCapped<T>(
  items: T[],
  item: T,
  getKey: (item: T) => unknown,
  limit: number
): T[] {
  const key = stableKey(getKey(item));
  const next = key ? items.filter((existing) => stableKey(getKey(existing)) !== key) : items;
  return [...next, item].slice(-limit);
}

function uniqueBy<T>(items: T[], getKey: (item: T) => unknown): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = stableKey(getKey(item));
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasChecklistShape(state: DiscoveryChecklistState): boolean {
  const candidate = state as unknown as {
    items?: unknown;
    bant?: unknown;
    openGaps?: unknown;
  };
  return (
    Array.isArray(candidate.items) &&
    candidate.bant != null &&
    typeof candidate.bant === "object" &&
    Array.isArray(candidate.openGaps)
  );
}

function normalizeSentimentSignal(signal: SentimentSignal): SentimentSignal {
  if (/^AE sentiment:/i.test(signal.label)) {
    return {
      ...signal,
      label: signal.label.replace(/^AE sentiment:/i, "Sales rep tone:"),
    };
  }
  return signal;
}

function mergeTranscriptEvent(
  existing: TranscriptEvent,
  incoming: TranscriptEvent
): TranscriptEvent {
  return {
    ...existing,
    ...incoming,
    id: incoming.id || existing.id,
    speakerId: incoming.speakerId || existing.speakerId,
    speakerName: incoming.speakerName || existing.speakerName,
    speakerRole: incoming.speakerRole ?? existing.speakerRole,
    text: incoming.text || existing.text,
    timestamp: Number.isFinite(incoming.timestamp)
      ? incoming.timestamp
      : existing.timestamp,
    keywords: incoming.keywords?.length ? incoming.keywords : existing.keywords,
    sentiment: incoming.sentiment ?? existing.sentiment,
    signalType: incoming.signalType ?? existing.signalType,
  };
}

function bantSignalKey(signal: BantSignal): string | null {
  const dimension = stableKey(signal.dimension);
  const timestamp = stableKey(signal.timestamp);
  if (dimension && timestamp) return `${dimension}:${timestamp}`;
  return stableKey(signal.id);
}

function bantSignalWeight(signal: BantSignal): number {
  let weight = 0;
  if (signal.value?.trim()) weight += 4;
  if (signal.snippet?.trim()) weight += 2;
  if ((signal.label || "").includes(":")) weight += 1;
  return weight;
}

function mergeBantSignal(existing: BantSignal, incoming: BantSignal): BantSignal {
  if (bantSignalWeight(incoming) < bantSignalWeight(existing)) return existing;
  return {
    ...existing,
    ...incoming,
    id: incoming.id || existing.id,
    dimension: incoming.dimension || existing.dimension,
    timestamp: Number.isFinite(incoming.timestamp) ? incoming.timestamp : existing.timestamp,
    label: incoming.label || existing.label,
    value: incoming.value || existing.value,
    snippet: incoming.snippet || existing.snippet,
    sentiment: incoming.sentiment ?? existing.sentiment,
  };
}

function checklistStatusRank(status: ChecklistItemStatus | undefined): number {
  if (status === "confirmed") return 3;
  if (status === "partial") return 2;
  if (status === "pending") return 1;
  return 0;
}

function bantStatusFromChecklist(status: ChecklistItemStatus | undefined): BANTStatus {
  if (status === "confirmed") return "confirmed";
  if (status === "partial") return "partial";
  return "unknown";
}

function mergeChecklistItem(
  existing: ChecklistItem | undefined,
  incoming: ChecklistItem
): ChecklistItem {
  if (!existing) return incoming;
  const existingRank = checklistStatusRank(existing.status);
  const incomingRank = checklistStatusRank(incoming.status);
  const winner =
    incomingRank > existingRank
      ? incoming
      : incomingRank < existingRank || existing.status === "confirmed"
        ? existing
        : incoming;
  const evidence = winner === incoming ? incoming.evidence : existing.evidence;
  return {
    ...existing,
    ...incoming,
    status: winner.status,
    evidence: evidence ?? [],
  };
}

function computeChecklistCoverage(items: ChecklistItem[]): Pick<DiscoveryChecklistState, "coverage" | "bantCoverage" | "openGaps" | "bant"> {
  const score = (status: ChecklistItemStatus) => (status === "confirmed" ? 1 : status === "partial" ? 0.5 : 0);
  const bantItems = items.filter((item) => item.tier === "bant");
  const coverage = items.length ? items.reduce((sum, item) => sum + score(item.status), 0) / items.length : 0;
  const bantCoverage = bantItems.length
    ? bantItems.reduce((sum, item) => sum + score(item.status), 0) / bantItems.length
    : 0;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const bant: DiscoveryChecklistState["bant"] = {
    budget: bantStatusFromChecklist(itemById.get("budget")?.status),
    authority: bantStatusFromChecklist(itemById.get("authority")?.status),
    need: bantStatusFromChecklist(itemById.get("need")?.status),
    timeline: bantStatusFromChecklist(itemById.get("timeline")?.status),
  };
  const openGaps = items
    .filter((item) => item.tier === "bant" && item.status !== "confirmed")
    .map((item) => item.id);
  return { coverage, bantCoverage, openGaps, bant };
}

function mergeChecklistState(
  existing: DiscoveryChecklistState | null,
  incoming: DiscoveryChecklistState
): DiscoveryChecklistState {
  if (!existing || existing.callId !== incoming.callId) return incoming;
  const existingById = new Map(existing.items.map((item) => [item.id, item]));
  const incomingIds = new Set(incoming.items.map((item) => item.id));
  const mergedItems = [
    ...incoming.items.map((item) => mergeChecklistItem(existingById.get(item.id), item)),
    ...existing.items.filter((item) => !incomingIds.has(item.id)),
  ];
  const computed = computeChecklistCoverage(mergedItems);
  return {
    ...incoming,
    items: mergedItems,
    ...computed,
  };
}

export const useLiveCall = create<LiveCallState>((set, get) => ({
  ...initialState,

  setCallId: (callId) => set({ callId }),
  setConnected: (isConnected) => set({ isConnected }),

  appendTranscriptEvent: (event) => {
    const eventId = stableKey(event.id);
    if (eventId && get().transcript.some((existing) => stableKey(existing.id) === eventId)) {
      set((s) => ({
        transcript: s.transcript.map((existing) =>
          stableKey(existing.id) === eventId
            ? mergeTranscriptEvent(existing, event)
            : existing
        ),
      }));
      return;
    }
    set((s) => ({
      transcript: [...s.transcript.slice(-499), event],
    }));
  },

  addNudge: (nudge) =>
    set((s) => ({
      pendingNudges: upsertCapped(s.pendingNudges, nudge, (item) => item.id, 5),
    })),

  addBantSignal: (signal) =>
    set((s) => {
      const key = bantSignalKey(signal);
      if (!key) {
        return { bantSignals: [...s.bantSignals.slice(-19), signal] };
      }
      const existingIndex = s.bantSignals.findIndex((item) => bantSignalKey(item) === key);
      if (existingIndex === -1) {
        return { bantSignals: [...s.bantSignals.slice(-19), signal] };
      }
      const next = [...s.bantSignals];
      next[existingIndex] = mergeBantSignal(next[existingIndex], signal);
      return { bantSignals: next };
    }),

  addSentimentSignal: (signal) =>
    set((s) => ({
      sentimentSignals: upsertCapped(
        s.sentimentSignals,
        normalizeSentimentSignal(signal),
        (item) => item.id,
        20
      ),
    })),

  dismissNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  acceptNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  updateSentiment: (
    sentimentAE,
    sentimentCustomer,
    shift,
    salesRepTone,
    customerSentiment
  ) =>
    set({
      sentimentAE,
      sentimentCustomer,
      ...(shift !== undefined ? { sentimentShift: shift ?? null } : {}),
      ...(salesRepTone !== undefined ? { salesRepTone } : {}),
      ...(customerSentiment !== undefined ? { customerSentiment } : {}),
    }),

  applyIntentUpdate: (payload) => {
    const focusAreas = Array.from(new Set(payload.focus_areas ?? []));
    const mergedPains = dedupePainSignals(
      uniqueBy(payload.pains ?? [], (pain) => pain.id)
    );
    const intentSnapshot: IntentSnapshot = {
      ...payload,
      focus_areas: focusAreas,
      pains: mergedPains,
      next_actions: payload.next_actions ?? [],
    };
    set({
      intentSnapshot,
      focusAreas,
    });
  },

  applyKeywordStats: (stats) => set({ keywordStats: filterKeywordStats(stats) }),

  applyChecklistUpdate: (state) => {
    if (!hasChecklistShape(state)) return;
    set((current) => ({
      checklistState: mergeChecklistState(
        current.checklistState,
        state as DiscoveryChecklistState
      ),
    }));
  },

  setSurfacedKbAssets: (assets) => {
    const seen = new Set<string>();
    const unique = assets.filter((a) => {
      if (!a.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    set({ surfacedKbAssets: unique.slice(0, 8) });
  },

  addObjection: (objection) =>
    set((s) => ({
      objections: upsertCapped(s.objections, objection, (item) => item.id, 5),
    })),

  addUnansweredQuestion: (q) =>
    set((s) => ({
      unansweredQuestions: upsertCapped(
        s.unansweredQuestions,
        q,
        (item) => item.id ?? item.question_id,
        10
      ),
    })),

  appendSuggestionLog: (entry) => {
    if (entry.operation === "intent_snapshot" || entry.operation === "intent_update") {
      return;
    }
    set((s) => ({
      suggestionLog: upsertCapped(s.suggestionLog, entry, (item) => item.id, 50),
    }));
  },

  hydrateFromStoredSession: ({ transcript, suggestionLog, sentimentAE, sentimentCustomer }) =>
    set({
      transcript: transcript.slice(-500),
      suggestionLog: suggestionLog.slice(-50),
      sentimentAE,
      sentimentCustomer,
    }),

  tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  reset: () => set(initialState),
}));
