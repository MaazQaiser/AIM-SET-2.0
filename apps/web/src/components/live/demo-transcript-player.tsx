"use client";

import { Button } from "@dc-copilot/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyApiDemoResult,
  applyClientDemoSegment,
  transcriptEventFromDemoLine,
} from "@/lib/demo/client-live-call-demo";
import { getDemoTranscriptForCall } from "@/lib/demo-live-transcript";
import { useLiveCall } from "@/stores/use-live-call";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { FastForward, Play, Square } from "lucide-react";
import { useRef, useState } from "react";

interface DemoTranscriptPlayerProps {
  callId: string;
  isConnected?: boolean;
}

type DemoMode = "api" | "client";
type PlaybackSpeed = "fast" | "normal";

function playbackDelayMs(pauseAfterMs: number | undefined, speed: PlaybackSpeed): number {
  if (speed === "fast") return 140;
  return pauseAfterMs ?? 2000;
}

export function DemoTranscriptPlayer({ callId }: DemoTranscriptPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DemoMode | null>(null);
  const [activeSpeed, setActiveSpeed] = useState<PlaybackSpeed>("normal");
  const stopRef = useRef(false);
  const modeRef = useRef<DemoMode>("api");
  const apiQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lines = getDemoTranscriptForCall(callId);
  const queryClient = useQueryClient();
  const appendTranscriptEvent = useLiveCall((s) => s.appendTranscriptEvent);
  const setConnected = useLiveCall((s) => s.setConnected);
  const setCallStatus = useDcImportsStore((s) => s.setCallStatus);

  function markCallCompleted() {
    setCallStatus(callId, "completed");
    void fetch(`/api/calls/${callId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }).finally(() => {
      void queryClient.invalidateQueries({ queryKey: ["calls"] });
      void queryClient.invalidateQueries({ queryKey: ["call", callId] });
    });
  }

  async function postDemoSegment(lineIndex: number) {
    const line = lines[lineIndex];
    const optimisticEvent = transcriptEventFromDemoLine(callId, line, lineIndex);
    const res = await fetch(`/api/calls/${callId}/demo-segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: optimisticEvent.id,
        text: line.text,
        speaker_id: line.speakerId,
        speaker_name: line.speakerName,
        speaker_role: line.speakerRole,
        offset_seconds: line.offsetSeconds,
        provider_event_id: `demo-${callId}-${lineIndex}`,
        async_analysis: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: string;
      transcript_event?: {
        id?: string;
        speaker_id?: string;
        speaker_role?: string;
        text?: string;
        offset_seconds?: number;
      };
    };
    if (!res.ok) {
      throw new Error(
        (typeof data.error === "string" ? data.error : undefined) ??
          `Segment ${lineIndex + 1} failed (${res.status})`
      );
    }
    const hasTranscriptMessage =
      Array.isArray(data.ws_messages) &&
      data.ws_messages.some(
        (msg) => msg && typeof msg === "object" && (msg as { type?: string }).type === "transcript"
      );
    const ev = data.transcript_event;
    if (!hasTranscriptMessage && ev?.text) {
      appendTranscriptEvent(transcriptEventFromDemoLine(callId, line, lineIndex));
    }
    applyApiDemoResult(data);
  }

  function enqueueApiSegment(lineIndex: number) {
    const run = apiQueueRef.current.then(async () => {
      try {
        await postDemoSegment(lineIndex);
      } catch {
        modeRef.current = "client";
        setMode("client");
        setConnected(true);
        setError(null);
      }
    });
    apiQueueRef.current = run.catch(() => undefined);
  }

  async function playDemo(speed: PlaybackSpeed) {
    if (playing || lines.length === 0) return;
    stopRef.current = false;
    setPlaying(true);
    setActiveSpeed(speed);
    setLineIndex(0);
    setError(null);
    apiQueueRef.current = Promise.resolve();

    const resolved: DemoMode =
      process.env.NEXT_PUBLIC_DEMO_CLIENT_ONLY === "true" ? "client" : "api";
    modeRef.current = resolved;
    setMode(resolved);
    markCallCompleted();

    setConnected(true);
    useLiveCall.getState().reset();
    useLiveCall.getState().setCallId(callId);
    useLiveCall.getState().setConnected(true);

    for (let i = 0; i < lines.length; i++) {
      if (stopRef.current) break;
      const line = lines[i];
      setLineIndex(i + 1);

      try {
        applyClientDemoSegment(callId, i, line);
        if (modeRef.current === "api") enqueueApiSegment(i);
      } catch (err) {
        modeRef.current = "client";
        setMode("client");
        setConnected(true);
        try {
          applyClientDemoSegment(callId, i, line);
        } catch {
          setError(err instanceof Error ? err.message : "Demo playback failed");
          break;
        }
      }

      await new Promise((r) => setTimeout(r, playbackDelayMs(line.pauseAfterMs, speed)));
    }

    setPlaying(false);
    if (!stopRef.current) {
      setLineIndex(0);
    }
  }

  function stopDemo() {
    stopRef.current = true;
    setPlaying(false);
    setLineIndex(0);
  }

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="type-label text-destructive max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
      {mode === "client" && playing && (
        <span className="type-caption text-muted-foreground hidden sm:inline">Local backup</span>
      )}
      {!playing ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 type-label"
            title="Replay scripted discovery call quickly. Uses API when available, otherwise local backup."
            onClick={() => void playDemo("fast")}
          >
            <FastForward className="h-3 w-3 mr-1" />
            Fast demo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 type-label"
            title="Replay scripted discovery call at normal conversation speed. Uses API when available, otherwise local backup."
            onClick={() => void playDemo("normal")}
          >
            <Play className="h-3 w-3 mr-1" />
            Normal demo
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 type-label"
          onClick={stopDemo}
        >
          <Square className="h-3 w-3 mr-1" />
          Stop {activeSpeed === "fast" ? "fast" : "normal"} ({lineIndex}/{lines.length})
        </Button>
      )}
    </div>
  );
}
