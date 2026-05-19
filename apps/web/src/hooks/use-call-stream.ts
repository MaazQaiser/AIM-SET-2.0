"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLiveCall } from "@/stores/use-live-call";
import type { TranscriptEvent, NudgePayload } from "@/types";

type StreamMessage =
  | { type: "transcript"; payload: TranscriptEvent }
  | { type: "nudge"; payload: NudgePayload }
  | { type: "sentiment"; payload: { ae: number; customer: number } }
  | { type: "ping" };

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

interface UseCallStreamOptions {
  callId: string;
  enabled?: boolean;
}

export function useCallStream({ callId, enabled = true }: UseCallStreamOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { setConnected, appendTranscriptEvent, addNudge, updateSentiment } = useLiveCall();

  const connect = useCallback(() => {
    if (!enabled) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000"}/ws/calls/${callId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: StreamMessage = JSON.parse(event.data as string);
          switch (msg.type) {
            case "transcript":
              appendTranscriptEvent(msg.payload);
              break;
            case "nudge":
              addNudge(msg.payload);
              break;
            case "sentiment":
              updateSentiment(msg.payload.ae, msg.payload.customer);
              break;
          }
        } catch {
          // Malformed message; ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_DELAY_MS * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (_ev: Event) => {
        ws.close();
      };
    } catch {
      setConnected(false);
    }
  }, [callId, enabled, setConnected, appendTranscriptEvent, addNudge, updateSentiment]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      setConnected(false);
    };
  }, [connect, setConnected]);

  const sendMessage = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { sendMessage };
}
