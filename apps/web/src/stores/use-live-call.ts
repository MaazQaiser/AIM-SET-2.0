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

export const useLiveCall = create<LiveCallState>((set) => ({
  ...initialState,

  setCallId: (callId) => set({ callId }),
  setConnected: (isConnected) => set({ isConnected }),

  appendTranscriptEvent: (event) =>
    set((s) => ({
      transcript: [...s.transcript.slice(-500), event],
    })),

  addNudge: (nudge) =>
    set((s) => ({
      pendingNudges: [...s.pendingNudges, nudge].slice(-5),
    })),

  addBantSignal: (signal) =>
    set((s) => ({
      bantSignals: [...s.bantSignals, signal].slice(-20),
    })),

  dismissNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  acceptNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  updateSentiment: (sentimentAE, sentimentCustomer) =>
    set({ sentimentAE, sentimentCustomer }),

  applyIntentUpdate: (payload) =>
    set({
      intentSnapshot: payload,
      focusAreas: payload.focus_areas ?? [],
    }),

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
    set((s) => ({ objections: [...s.objections, objection].slice(-5) })),

  addUnansweredQuestion: (q) =>
    set((s) => ({
      unansweredQuestions: [...s.unansweredQuestions, q].slice(-10),
    })),

  appendSuggestionLog: (entry) =>
    set((s) => ({
      suggestionLog: [...s.suggestionLog, entry].slice(-50),
    })),

  tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  reset: () => set(initialState),
}));
