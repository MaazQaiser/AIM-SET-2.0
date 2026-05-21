"use client";

import { Button } from "@/components/ui/button";
import { DEMO_LIVE_TRANSCRIPT } from "@/lib/demo-live-transcript";
import { Play, Square } from "lucide-react";
import { useRef, useState } from "react";

interface DemoTranscriptPlayerProps {
  callId: string;
  isConnected: boolean;
}

export function DemoTranscriptPlayer({ callId, isConnected }: DemoTranscriptPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function playDemo() {
    if (!isConnected || playing) return;
    stopRef.current = false;
    setPlaying(true);
    setLineIndex(0);
    setError(null);

    for (let i = 0; i < DEMO_LIVE_TRANSCRIPT.length; i++) {
      if (stopRef.current) break;
      const line = DEMO_LIVE_TRANSCRIPT[i];
      setLineIndex(i + 1);

      try {
        const res = await fetch(`/api/calls/${callId}/demo-segment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: line.text,
            speaker_id: line.speakerId,
            speaker_role: line.speakerRole,
            offset_seconds: line.offsetSeconds,
            provider_event_id: `demo-${callId}-${i}`,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Segment ${i + 1} failed (${res.status})`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Demo playback failed");
        break;
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

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-destructive max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
      {!playing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={!isConnected}
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
          Stop ({lineIndex}/{DEMO_LIVE_TRANSCRIPT.length})
        </Button>
      )}
    </div>
  );
}
