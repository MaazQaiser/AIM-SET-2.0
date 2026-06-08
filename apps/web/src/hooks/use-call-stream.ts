"use client";

import { useEffect, useRef, useCallback } from "react";
import { getPublicWsUrl } from "@/lib/public-env";
import { useBotChatStore } from "@/stores/use-bot-chat";
import { useLiveCall } from "@/stores/use-live-call";
import type {
  TranscriptEvent,
  NudgePayload,
  IntentSnapshot,
  KeywordStats,
  LiveSentimentPayload,
  ObjectionPayload,
  PodRole,
  SentimentSignal,
  SurfacedKbAsset,
  SuggestionLogEntry,
  UnansweredQuestionPayload,
  Citation,
} from "@/types";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";

type StreamMessage =
  | { type: "transcript"; payload: TranscriptEvent }
  | { type: "nudge"; payload: NudgePayload }
  | { type: "sentiment"; payload: LiveSentimentPayload }
  | { type: "sentiment_signal"; payload: SentimentSignal }
  | { type: "intent_update"; payload: IntentSnapshot }
  | { type: "keyword_stats"; payload: KeywordStats }
  | { type: "bant_signal"; payload: BantSignal }
  | { type: "checklist_update"; payload: unknown }
  | { type: "kb_assets"; payload: SurfacedKbAsset[] }
  | { type: "objection"; payload: ObjectionPayload }
  | { type: "unanswered_question"; payload: UnansweredQuestionPayload }
  | { type: "suggestion_log"; payload: SuggestionLogEntry }
  | {
      type: "bot_chat";
      payload: {
        answer?: string;
        citations?: { id: string; title: string; type: string; excerpt?: string }[];
        message_id?: string;
        sender_name?: string;
        sender_role?: string;
      };
    }
  | { type: "ping" };

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

interface UseCallStreamOptions {
  callId: string;
  enabled?: boolean;
}

function normalizeNudge(raw: Record<string, unknown>): NudgePayload {
  const citation = (raw.citation as NudgePayload["citation"]) || {
    id: String(raw.id ?? "cite"),
    title: "Live transcript",
    type: "transcript" as const,
    excerpt: String(raw.message ?? ""),
  };
  const role = (raw.role as PodRole) || "ae";
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    message: String(raw.message ?? ""),
    citation,
    role,
    timestamp: Number(raw.timestamp ?? 0),
    source: raw.source as NudgePayload["source"],
    checklistItemId: raw.checklistItemId as string | undefined,
    suggestionId: (raw.suggestionId as string | undefined) ?? undefined,
  };
}

export function useCallStream({ callId, enabled = true }: UseCallStreamOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shouldReconnectRef = useRef(false);
  const callIdRef = useRef(callId);
  callIdRef.current = callId;

  useEffect(() => {
    if (!enabled || !callId) {
      return undefined;
    }

    shouldReconnectRef.current = true;

    const openSocket = () => {
      const existing = wsRef.current;
      if (
        existing &&
        (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)
      ) {
        return;
      }

      const wsUrl = `${getPublicWsUrl()}/ws/calls/${callIdRef.current}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          useLiveCall.getState().setConnected(true);
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event: MessageEvent) => {
          if (wsRef.current !== ws) return;
          try {
            const raw = JSON.parse(event.data as string) as { type: string; payload?: unknown };
            const msg = raw as StreamMessage;
            const store = useLiveCall.getState();
            // Discard messages that arrived for a different callId (stale socket)
            if (store.callId && store.callId !== callIdRef.current) return;
            switch (msg.type) {
              case "transcript":
                store.appendTranscriptEvent(msg.payload);
                break;
              case "nudge":
                store.addNudge(normalizeNudge(msg.payload as unknown as Record<string, unknown>));
                break;
              case "sentiment":
                store.updateSentiment(
                  msg.payload.ae,
                  msg.payload.customer,
                  msg.payload.shift ?? null,
                  msg.payload.salesRepTone,
                  msg.payload.customerSentiment
                );
                if (msg.payload.signal) {
                  store.addSentimentSignal(msg.payload.signal);
                }
                break;
              case "sentiment_signal":
                store.addSentimentSignal(msg.payload);
                break;
              case "intent_update":
                store.applyIntentUpdate(msg.payload);
                break;
              case "keyword_stats":
                store.applyKeywordStats(msg.payload);
                break;
              case "bant_signal": {
                const bp = msg.payload;
                if (Array.isArray(bp)) {
                  for (const s of bp) store.addBantSignal(s as BantSignal);
                } else {
                  store.addBantSignal(bp);
                }
                break;
              }
              case "checklist_update":
                if (msg.payload && typeof msg.payload === "object") {
                  store.applyChecklistUpdate(msg.payload as DiscoveryChecklistState);
                }
                break;
              case "kb_assets":
                store.setSurfacedKbAssets(msg.payload as SurfacedKbAsset[]);
                break;
              case "objection":
                store.addObjection(msg.payload as ObjectionPayload);
                break;
              case "unanswered_question":
                store.addUnansweredQuestion(msg.payload as UnansweredQuestionPayload);
                break;
              case "suggestion_log":
                store.appendSuggestionLog(msg.payload as SuggestionLogEntry);
                break;
              case "bot_chat": {
                const p = msg.payload;
                if (p?.answer) {
                  useBotChatStore.getState().appendGroupFromWs(callIdRef.current, {
                    id: p.message_id ?? crypto.randomUUID(),
                    role: "assistant",
                    content: p.answer,
                    citations: (p.citations ?? []).map(
                      (c, i): Citation => ({
                        id: c.id ?? `cite-${i}`,
                        title: c.title ?? "Source",
                        type: (c.type as Citation["type"]) ?? "transcript",
                        excerpt: c.excerpt,
                      })
                    ),
                    authorName: "DC Copilot",
                    createdAt: Date.now(),
                  });
                }
                break;
              }
            }
          } catch {
            // Malformed message; ignore
          }
        };

        ws.onclose = () => {
          if (wsRef.current !== ws) return;

          useLiveCall.getState().setConnected(false);
          wsRef.current = null;

          if (shouldReconnectRef.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = BASE_DELAY_MS * 2 ** reconnectAttempts.current;
            reconnectAttempts.current++;
            reconnectTimer.current = setTimeout(openSocket, delay);
          }
        };

        ws.onerror = () => {
          if (wsRef.current === ws) {
            ws.close();
          }
        };
      } catch {
        useLiveCall.getState().setConnected(false);
      }
    };

    openSocket();

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
      useLiveCall.getState().setConnected(false);
    };
  }, [callId, enabled]);

  const sendTranscript = useCallback(
    (segment: {
      text: string;
      speakerId?: string;
      speakerName?: string;
      speakerRole?: string;
      timestamp?: number;
      elapsedSeconds?: number;
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "transcript",
            text: segment.text,
            elapsedSeconds: segment.elapsedSeconds ?? segment.timestamp ?? 0,
            payload: {
              text: segment.text,
              speakerId: segment.speakerId ?? "unknown",
              speakerName: segment.speakerName ?? "Speaker",
              speakerRole: segment.speakerRole ?? "customer",
              timestamp: segment.timestamp ?? segment.elapsedSeconds ?? 0,
            },
          })
        );
      }
    },
    []
  );

  return { sendTranscript };
}
