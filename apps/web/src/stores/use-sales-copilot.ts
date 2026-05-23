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
  createdAt: number;
}

interface SalesCopilotStore {
  messages: CopilotMessage[];
  isLoading: boolean;
  pendingFile: File | null;
  appendMessage: (message: CopilotMessage) => void;
  setLoading: (loading: boolean) => void;
  setPendingFile: (file: File | null) => void;
  clearHistory: () => void;
  seedWelcome: () => void;
}

export const useSalesCopilotStore = create<SalesCopilotStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      pendingFile: null,

      appendMessage: (message) =>
        set((s) => ({ messages: [...s.messages, message] })),

      setLoading: (isLoading) => set({ isLoading }),

      setPendingFile: (pendingFile) => set({ pendingFile }),

      clearHistory: () => set({ messages: [] }),

      seedWelcome: () => {
        if (get().messages.length > 0) return;
        get().appendMessage({
          id: "copilot-welcome",
          role: "system",
          content:
            "**Sales Co-pilot** — search your knowledge base, inspect any call, run agents (brief, post-call, relevant content), or upload files to KB.",
          createdAt: Date.now(),
        });
      },
    }),
    {
      name: "sales-copilot-v1",
      partialize: (s) => ({ messages: s.messages }),
    }
  )
);
