import { create } from "zustand";
import type { TranscriptEvent, NudgePayload } from "@/types";

interface LiveCallState {
  callId: string | null;
  isConnected: boolean;
  transcript: TranscriptEvent[];
  pendingNudges: NudgePayload[];
  elapsedSeconds: number;
  sentimentAE: number;
  sentimentCustomer: number;

  setCallId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  appendTranscriptEvent: (event: TranscriptEvent) => void;
  addNudge: (nudge: NudgePayload) => void;
  dismissNudge: (id: string) => void;
  acceptNudge: (id: string) => void;
  updateSentiment: (ae: number, customer: number) => void;
  tickElapsed: () => void;
  reset: () => void;
}

const initialState = {
  callId: null,
  isConnected: false,
  transcript: [],
  pendingNudges: [],
  elapsedSeconds: 0,
  sentimentAE: 0,
  sentimentCustomer: 0,
};

export const useLiveCall = create<LiveCallState>((set) => ({
  ...initialState,

  setCallId: (callId) => set({ callId }),
  setConnected: (isConnected) => set({ isConnected }),

  appendTranscriptEvent: (event) =>
    set((s) => ({
      transcript: [...s.transcript.slice(-500), event], // keep last 500 events
    })),

  addNudge: (nudge) =>
    set((s) => ({
      pendingNudges: [...s.pendingNudges, nudge].slice(-5), // max 5 pending
    })),

  dismissNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  acceptNudge: (id) =>
    set((s) => ({ pendingNudges: s.pendingNudges.filter((n) => n.id !== id) })),

  updateSentiment: (sentimentAE, sentimentCustomer) =>
    set({ sentimentAE, sentimentCustomer }),

  tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  reset: () => set(initialState),
}));
