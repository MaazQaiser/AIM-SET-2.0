"use client";

import { useEffect, useRef } from "react";
import { useLiveCall } from "@/stores/use-live-call";
import type { SuggestionLogEntry, TranscriptEvent } from "@/types";

function mapStoredEvent(row: Record<string, unknown>): TranscriptEvent {
  const offset = Number(row.offset_seconds ?? 0);
  return {
    id: String(row.id ?? crypto.randomUUID()),
    speakerId: String(row.speaker_id ?? "unknown"),
    speakerName: String(row.speaker_name ?? row.speaker_id ?? "Speaker"),
    speakerRole: (row.speaker_role as TranscriptEvent["speakerRole"]) ?? "customer",
    text: String(row.text ?? ""),
    timestamp: offset,
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
  };
}

function mapSuggestionLog(row: Record<string, unknown>): SuggestionLogEntry | null {
  const id = row.id;
  if (!id) return null;
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const shownAt = row.shown_at as string | undefined;
  const ts = shownAt ? Date.parse(shownAt) : Date.now();
  return {
    id: String(id),
    operation: String(row.operation ?? "unknown"),
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    shownAt,
    confidence: Number(row.confidence ?? 0),
    trace_id: row.trace_id as string | undefined,
    summary: String(
      payload.message ??
        payload.objection_text ??
        payload.call_direction ??
        payload.text ??
        row.operation ??
        ""
    ).slice(0, 120),
  };
}

/** Initialize live call session (WebSocket transcript feed connects separately). */
export function useLiveCallInit(callId: string) {
  const initialized = useRef(false);
  const setCallId = useLiveCall((s) => s.setCallId);
  const reset = useLiveCall((s) => s.reset);
  const appendTranscriptEvent = useLiveCall((s) => s.appendTranscriptEvent);
  const appendSuggestionLog = useLiveCall((s) => s.appendSuggestionLog);
  const transcript = useLiveCall((s) => s.transcript);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    reset();
    setCallId(callId);

    const tick = setInterval(() => {
      useLiveCall.getState().tickElapsed();
    }, 1000);

    void (async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/live-session`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          events?: Record<string, unknown>[];
          suggestions?: Record<string, unknown>[];
        };
        for (const row of data.events ?? []) {
          appendTranscriptEvent(mapStoredEvent(row));
        }
        for (const row of data.suggestions ?? []) {
          const entry = mapSuggestionLog(row);
          if (entry) appendSuggestionLog(entry);
        }
      } catch {
        /* non-blocking — live stream is primary */
      }
    })();

    return () => {
      clearInterval(tick);
      reset();
      initialized.current = false;
    };
  }, [callId, reset, setCallId, appendTranscriptEvent, appendSuggestionLog]);

  return { transcript };
}
