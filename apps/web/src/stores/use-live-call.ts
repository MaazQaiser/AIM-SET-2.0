import { create } from "zustand";
import type {
  TranscriptEvent,
  NudgePayload,
  IntentSnapshot,
  KeywordStats,
  ObjectionPayload,
  SurfacedKbAsset,
  SuggestionLogEntry,
  UnansweredQuestionPayload,
} from "@/types";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";

interface LiveCallState {
  callId: string | null;
  isConnected: boolean;
  transcript: TranscriptEvent[];
  pendingNudges: NudgePayload[];
  bantSignals: BantSignal[];
  elapsedSeconds: number;
  sentimentAE: number;
  sentimentCustomer: number;
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
  dismissNudge: (id: string) => void;
  acceptNudge: (id: string) => void;
  updateSentiment: (ae: number, customer: number) => void;
  applyIntentUpdate: (payload: IntentSnapshot) => void;
  applyKeywordStats: (stats: KeywordStats) => void;
  applyChecklistUpdate: (state: DiscoveryChecklistState) => void;
  setSurfacedKbAssets: (assets: SurfacedKbAsset[]) => void;
  addObjection: (objection: ObjectionPayload) => void;
  addUnansweredQuestion: (q: UnansweredQuestionPayload) => void;
  appendSuggestionLog: (entry: SuggestionLogEntry) => void;
  tickElapsed: () => void;
  reset: () => void;
}

const initialState = {
  callId: null,
  isConnected: false,
  transcript: [],
  pendingNudges: [],
  bantSignals: [],
  elapsedSeconds: 0,
  sentimentAE: 0,
  sentimentCustomer: 0,
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

export const useLiveCall = create<LiveCallState>((set, get) => ({
  ...initialState,

  setCallId: (callId) => set({ callId }),
  setConnected: (isConnected) => set({ isConnected }),

  appendTranscriptEvent: (event) => {
    const eventId = stableKey(event.id);
    if (eventId && get().transcript.some((existing) => stableKey(existing.id) === eventId)) {
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
    set((s) => ({
      bantSignals: upsertCapped(s.bantSignals, signal, (item) => item.id, 20),
    })),

  dismissNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  acceptNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  updateSentiment: (sentimentAE, sentimentCustomer) =>
    set({ sentimentAE, sentimentCustomer }),

  applyIntentUpdate: (payload) => {
    const focusAreas = Array.from(new Set(payload.focus_areas ?? []));
    const intentSnapshot = {
      ...payload,
      focus_areas: focusAreas,
      pains: uniqueBy(payload.pains ?? [], (pain) => pain.id),
    };
    set({
      intentSnapshot,
      focusAreas,
    });
  },

  applyKeywordStats: (stats) => set({ keywordStats: stats }),

  applyChecklistUpdate: (state) =>
    set({ checklistState: state as DiscoveryChecklistState }),

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

  appendSuggestionLog: (entry) =>
    set((s) => ({
      suggestionLog: upsertCapped(s.suggestionLog, entry, (item) => item.id, 50),
    })),

  tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  reset: () => set(initialState),
}));
