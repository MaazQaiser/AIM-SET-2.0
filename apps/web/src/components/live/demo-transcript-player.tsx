"use client";

import { Button } from "@dc-copilot/ui/components/button";
import {
  applyApiDemoResult,
  applyClientDemoSegment,
  transcriptEventFromDemoLine,
} from "@/lib/demo/client-live-call-demo";
import { getDemoTranscriptForCall } from "@/lib/demo-live-transcript";
import { useLiveCall } from "@/stores/use-live-call";
import { Play, Square } from "lucide-react";
import { useRef, useState } from "react";

interface DemoTranscriptPlayerProps {
  callId: string;
  isConnected?: boolean;
}

type DemoMode = "api" | "client";

export function DemoTranscriptPlayer({ callId }: DemoTranscriptPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DemoMode | null>(null);
  const stopRef = useRef(false);
  const modeRef = useRef<DemoMode>("api");
  const apiQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lines = getDemoTranscriptForCall(callId);
  const appendTranscriptEvent = useLiveCall((s) => s.appendTranscriptEvent);
  const setConnected = useLiveCall((s) => s.setConnected);

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
      } catch (err) {
        modeRef.current = "client";
        setMode("client");
        setConnected(true);
        setError(err instanceof Error ? err.message : "Demo API playback failed");
      }
    });
    apiQueueRef.current = run.catch(() => undefined);
  }

  async function playDemo() {
    if (playing || lines.length === 0) return;
    stopRef.current = false;
    setPlaying(true);
    setLineIndex(0);
    setError(null);
    apiQueueRef.current = Promise.resolve();

    const resolved: DemoMode =
      process.env.NEXT_PUBLIC_DEMO_CLIENT_ONLY === "true" ? "client" : "api";
    modeRef.current = resolved;
    setMode(resolved);

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

      await new Promise((r) => setTimeout(r, line.pauseAfterMs ?? 2000));
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

  const demoEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_DEMO_TRANSCRIPT === "true";

  if (!demoEnabled) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-destructive max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
      {mode === "client" && playing && (
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Offline demo</span>
      )}
      {!playing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          title="Replay scripted discovery call — uses API when available, otherwise local simulation"
          onClick={() => void playDemo()}
        >
          <Play className="h-3 w-3 mr-1" />
          Play demo transcript
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={stopDemo}
        >
          <Square className="h-3 w-3 mr-1" />
          Stop ({lineIndex}/{lines.length})
        </Button>
      )}
    </div>
  );
}
