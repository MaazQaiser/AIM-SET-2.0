"use client";

import { useEffect } from "react";
import { useBotChatStore } from "@/stores/use-bot-chat";
import { useLiveCall } from "@/stores/use-live-call";
import { useSalesCopilotStore } from "@/stores/use-sales-copilot";

/** Initialize live call session (WebSocket transcript feed connects separately). */
export function useLiveCallInit(callId: string) {
  const setCallId = useLiveCall((s) => s.setCallId);
  const reset = useLiveCall((s) => s.reset);

  useEffect(() => {
    // Always start with a clean null state — no transcript, nudges, or agent data from past sessions
    reset();
    setCallId(callId);
    useBotChatStore.getState().resetCall(callId);
    useSalesCopilotStore.getState().clearHistory(`live_dc:${callId}`);

    const tick = setInterval(() => {
      useLiveCall.getState().tickElapsed();
    }, 1000);

    return () => {
      clearInterval(tick);
      reset();
    };
  }, [callId, reset, setCallId]);
}
