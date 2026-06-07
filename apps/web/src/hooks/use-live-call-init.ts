"use client";

import { useEffect, useRef } from "react";
import { useBotChatStore } from "@/stores/use-bot-chat";
import { useLiveCall } from "@/stores/use-live-call";
import { useSalesCopilotStore } from "@/stores/use-sales-copilot";

/** Initialize live call session (WebSocket transcript feed connects separately). */
export function useLiveCallInit(callId: string) {
  const initialized = useRef(false);
  const setCallId = useLiveCall((s) => s.setCallId);
  const reset = useLiveCall((s) => s.reset);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
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
      initialized.current = false;
    };
  }, [callId, reset, setCallId]);
}
