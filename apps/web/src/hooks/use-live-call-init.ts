"use client";

import { useEffect, useRef } from "react";
import { useLiveCall } from "@/stores/use-live-call";
import { LIVE_NUDGES_SEED, LIVE_TRANSCRIPT_SEED } from "@/lib/mock-data";

export function useLiveCallInit(callId: string) {
  const initialized = useRef(false);
  const setCallId = useLiveCall((s) => s.setCallId);
  const setConnected = useLiveCall((s) => s.setConnected);
  const reset = useLiveCall((s) => s.reset);
  const appendTranscriptEvent = useLiveCall((s) => s.appendTranscriptEvent);
  const addNudge = useLiveCall((s) => s.addNudge);
  const transcript = useLiveCall((s) => s.transcript);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    reset();
    setCallId(callId);
    setConnected(true);
    LIVE_TRANSCRIPT_SEED.forEach(appendTranscriptEvent);
    LIVE_NUDGES_SEED.forEach(addNudge);

    const tick = setInterval(() => {
      useLiveCall.getState().tickElapsed();
    }, 1000);

    return () => {
      clearInterval(tick);
      reset();
      initialized.current = false;
    };
  }, [callId, reset, setCallId, setConnected, appendTranscriptEvent, addNudge]);

  return { transcript };
}
