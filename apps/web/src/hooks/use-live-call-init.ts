"use client";

import { useEffect, useRef } from "react";
import { useLiveCall } from "@/stores/use-live-call";

/** Initialize live call session (WebSocket transcript feed connects separately). */
export function useLiveCallInit(callId: string) {
  const initialized = useRef(false);
  const setCallId = useLiveCall((s) => s.setCallId);
  const setConnected = useLiveCall((s) => s.setConnected);
  const reset = useLiveCall((s) => s.reset);
  const transcript = useLiveCall((s) => s.transcript);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    reset();
    setCallId(callId);

    const tick = setInterval(() => {
      useLiveCall.getState().tickElapsed();
    }, 1000);

    return () => {
      clearInterval(tick);
      reset();
      initialized.current = false;
    };
  }, [callId, reset, setCallId, setConnected]);

  return { transcript };
}
