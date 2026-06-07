import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Citation } from "@/types";

export interface CopilotAgentAction {
  tool?: string;
  agent?: string;
  callId?: string;
  status?: string;
  summary?: string;
}

export interface CopilotCallExport {
  call_id?: string;
  markdown?: string;
  call?: Record<string, unknown>;
  brief?: Record<string, unknown>;
  transcript?: unknown[];
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  actions?: CopilotAgentAction[];
  callExports?: CopilotCallExport[];
  suggestions?: string[];
  confidence?: number;
  missingEvidence?: string[];
  createdAt: number;
}

interface SalesCopilotStore {
  messages: CopilotMessage[];
  byThreadId: Record<string, CopilotMessage[]>;
  isLoading: boolean;
  loadingByThreadId: Record<string, boolean>;
  pendingFile: File | null;
  appendMessage: (message: CopilotMessage, threadId?: string) => void;
  setLoading: (loading: boolean, threadId?: string) => void;
  setPendingFile: (file: File | null) => void;
  clearHistory: (threadId?: string) => void;
  seedWelcome: (threadId?: string) => void;
}

const DEFAULT_THREAD_ID = "global";

export const useSalesCopilotStore = create<SalesCopilotStore>()(
  persist(
    (set, get) => ({
      messages: [],
      byThreadId: {},
      isLoading: false,
      loadingByThreadId: {},
      pendingFile: null,

      appendMessage: (message, threadId = DEFAULT_THREAD_ID) =>
        set((s) => {
          const prev = s.byThreadId[threadId] ?? [];
          return {
            messages: threadId === DEFAULT_THREAD_ID ? [...s.messages, message] : s.messages,
            byThreadId: {
              ...s.byThreadId,
              [threadId]: [...prev, message],
            },
          };
        }),

      setLoading: (isLoading, threadId = DEFAULT_THREAD_ID) =>
        set((s) => ({
          isLoading: threadId === DEFAULT_THREAD_ID ? isLoading : s.isLoading,
          loadingByThreadId: {
            ...s.loadingByThreadId,
            [threadId]: isLoading,
          },
        })),

      setPendingFile: (pendingFile) => set({ pendingFile }),

      clearHistory: (threadId = DEFAULT_THREAD_ID) =>
        set((s) => {
          if (threadId === DEFAULT_THREAD_ID) return { messages: [], byThreadId: {} };
          const next = { ...s.byThreadId };
          delete next[threadId];
          return { byThreadId: next };
        }),

      seedWelcome: (threadId = DEFAULT_THREAD_ID) => {
        const state = get();
        const messages = state.byThreadId[threadId] ?? (threadId === DEFAULT_THREAD_ID ? state.messages : []);
        if (messages.length > 0) return;
        get().appendMessage({
          id: "copilot-welcome",
          role: "system",
          content:
            "**Sales Co-pilot** — search your knowledge base, inspect any call, run agents (brief, post-call, relevant content), or upload files to KB.",
          createdAt: Date.now(),
        }, threadId);
      },
    }),
    {
      name: "sales-copilot-v1",
      partialize: (s) => ({ messages: s.messages, byThreadId: s.byThreadId }),
    }
  )
);
