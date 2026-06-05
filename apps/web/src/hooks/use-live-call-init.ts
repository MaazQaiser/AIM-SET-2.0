"use client";

import { useEffect, useRef } from "react";
import { useLiveCall } from "@/stores/use-live-call";
import type { SuggestionLogEntry, TranscriptEvent } from "@/types";

function sentimentLabel(value: unknown): TranscriptEvent["sentiment"] | undefined {
  return value === "positive" || value === "negative" || value === "neutral" ? value : undefined;
}

function sentimentScore(value: TranscriptEvent["sentiment"]): number {
  if (value === "positive") return 0.55;
  if (value === "negative") return -0.65;
  return 0;
}

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
    sentiment: sentimentLabel(row.sentiment),
    signalType:
      typeof row.signal_type === "string"
        ? row.signal_type
        : typeof row.signalType === "string"
          ? row.signalType
          : undefined,
  };
}

function mapSuggestionLog(row: Record<string, unknown>): SuggestionLogEntry | null {
  const id = row.id;
  if (!id) return null;
  const operation = String(row.operation ?? "unknown");
  if (operation === "intent_snapshot" || operation === "intent_update") return null;
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const shownAt = row.shown_at as string | undefined;
  const ts = shownAt ? Date.parse(shownAt) : Date.now();
  return {
    id: String(id),
    operation,
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
  const hydrateFromStoredSession = useLiveCall((s) => s.hydrateFromStoredSession);

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

        const transcript = (data.events ?? []).map(mapStoredEvent);
        const suggestionLog = (data.suggestions ?? [])
          .map(mapSuggestionLog)
          .filter((entry): entry is SuggestionLogEntry => entry != null);

        let sentimentAE = 0;
        let sentimentCustomer = 0;
        for (const event of transcript) {
          if (!event.sentiment) continue;
          const score = sentimentScore(event.sentiment);
          if (
            event.speakerRole === "ae" ||
            event.speakerRole === "se" ||
            event.speakerRole === "designer"
          ) {
            sentimentAE = score;
          } else {
            sentimentCustomer = score;
          }
        }

        hydrateFromStoredSession({
          transcript,
          suggestionLog,
          sentimentAE,
          sentimentCustomer,
        });
      } catch {
        /* non-blocking — live stream is primary */
      }
    })();

    return () => {
      clearInterval(tick);
      reset();
      initialized.current = false;
    };
  }, [callId, reset, setCallId, hydrateFromStoredSession]);
}
