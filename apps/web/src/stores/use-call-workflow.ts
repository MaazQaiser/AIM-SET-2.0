"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DealOutcome = "won" | "lost";

export interface DealClosure {
  outcome: DealOutcome;
  lostReason?: string;
  closedAt: string;
}

export interface PrepReadyState {
  readyAt: string;
}

interface CallWorkflowState {
  prepReadyByCallId: Record<string, PrepReadyState>;
  dealClosureByCallId: Record<string, DealClosure>;
  markPrepReady: (callId: string) => void;
  clearPrepReady: (callId: string) => void;
  setDealClosure: (callId: string, closure: DealClosure) => void;
  clearDealClosure: (callId: string) => void;
}

export const useCallWorkflowStore = create<CallWorkflowState>()(
  persist(
    (set) => ({
      prepReadyByCallId: {},
      dealClosureByCallId: {},
      markPrepReady: (callId) =>
        set((state) => ({
          prepReadyByCallId: {
            ...state.prepReadyByCallId,
            [callId]: { readyAt: new Date().toISOString() },
          },
        })),
      clearPrepReady: (callId) =>
        set((state) => {
          const next = { ...state.prepReadyByCallId };
          delete next[callId];
          return { prepReadyByCallId: next };
        }),
      setDealClosure: (callId, closure) =>
        set((state) => ({
          dealClosureByCallId: {
            ...state.dealClosureByCallId,
            [callId]: closure,
          },
        })),
      clearDealClosure: (callId) =>
        set((state) => {
          const next = { ...state.dealClosureByCallId };
          delete next[callId];
          return { dealClosureByCallId: next };
        }),
    }),
    { name: "dc-call-workflow" }
  )
);

export function usePrepReady(callId: string) {
  const ready = useCallWorkflowStore((s) => s.prepReadyByCallId[callId]);
  const markPrepReady = useCallWorkflowStore((s) => s.markPrepReady);
  const clearPrepReady = useCallWorkflowStore((s) => s.clearPrepReady);

  return {
    isReady: Boolean(ready),
    readyAt: ready?.readyAt,
    markReady: () => markPrepReady(callId),
    clearReady: () => clearPrepReady(callId),
  };
}

export function useDealClosure(callId: string) {
  const closure = useCallWorkflowStore((s) => s.dealClosureByCallId[callId]);
  const setDealClosure = useCallWorkflowStore((s) => s.setDealClosure);
  const clearDealClosure = useCallWorkflowStore((s) => s.clearDealClosure);

  return {
    closure,
    isClosed: Boolean(closure),
    closeDeal: (outcome: DealOutcome, lostReason?: string) =>
      setDealClosure(callId, {
        outcome,
        lostReason: outcome === "lost" ? lostReason?.trim() || undefined : undefined,
        closedAt: new Date().toISOString(),
      }),
    reopenDeal: () => clearDealClosure(callId),
  };
}
