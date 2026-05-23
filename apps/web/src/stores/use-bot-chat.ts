import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BotChatMessage, BotChatMode } from "@/lib/bot-chat/types";

interface CallChatState {
  mode: BotChatMode;
  directMessages: BotChatMessage[];
  groupMessages: BotChatMessage[];
}

interface BotChatStore {
  byCallId: Record<string, CallChatState>;
  getMode: (callId: string) => BotChatMode;
  setMode: (callId: string, mode: BotChatMode) => void;
  getMessages: (callId: string, mode: BotChatMode) => BotChatMessage[];
  appendMessage: (callId: string, mode: BotChatMode, message: BotChatMessage) => void;
  appendGroupFromWs: (callId: string, message: BotChatMessage) => void;
  seedGroupWelcome: (callId: string, accountName?: string) => void;
}

export const EMPTY_BOT_CHAT_MESSAGES: BotChatMessage[] = [];

const defaultCallState = (): CallChatState => ({
  mode: "group",
  directMessages: EMPTY_BOT_CHAT_MESSAGES,
  groupMessages: EMPTY_BOT_CHAT_MESSAGES,
});

export const useBotChatStore = create<BotChatStore>()(
  persist(
    (set, get) => ({
      byCallId: {},

      getMode: (callId) => get().byCallId[callId]?.mode ?? "group",

      setMode: (callId, mode) =>
        set((s) => {
          const prev = s.byCallId[callId] ?? defaultCallState();
          return {
            byCallId: {
              ...s.byCallId,
              [callId]: { ...prev, mode },
            },
          };
        }),

      getMessages: (callId, mode) => {
        const st = get().byCallId[callId];
        if (!st) return EMPTY_BOT_CHAT_MESSAGES;
        return mode === "group" ? st.groupMessages : st.directMessages;
      },

      appendMessage: (callId, mode, message) =>
        set((s) => {
          const prev = s.byCallId[callId] ?? defaultCallState();
          const key = mode === "group" ? "groupMessages" : "directMessages";
          return {
            byCallId: {
              ...s.byCallId,
              [callId]: {
                ...prev,
                [key]: [...prev[key], message],
              },
            },
          };
        }),

      appendGroupFromWs: (callId, message) =>
        set((s) => {
          const prev = s.byCallId[callId] ?? defaultCallState();
          if (prev.groupMessages.some((m) => m.id === message.id)) return s;
          return {
            byCallId: {
              ...s.byCallId,
              [callId]: {
                ...prev,
                groupMessages: [...prev.groupMessages, message],
              },
            },
          };
        }),

      seedGroupWelcome: (callId, accountName) => {
        const prev = get().byCallId[callId] ?? defaultCallState();
        if (prev.groupMessages.length > 0) return;
        get().appendMessage(callId, "group", {
          id: `welcome-${callId}`,
          role: "system",
          content: accountName
            ? `Pod room for **${accountName}** — chat with your team and @ DC Copilot. Suggested actions below help you prepare and steer the call.`
            : "Pod room open — chat with your team and DC Copilot. Use suggested actions to prepare and steer the call.",
          createdAt: Date.now(),
        });
      },
    }),
    {
      name: "dc-bot-chat-v1",
      partialize: (s) => ({ byCallId: s.byCallId }),
    }
  )
);
