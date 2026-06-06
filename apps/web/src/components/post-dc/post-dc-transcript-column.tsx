"use client";

import { PostDcTranscriptPanel } from "@/components/post-dc/post-dc-transcript-panel";
import { cn } from "@/lib/cn";

interface PostDcTranscriptColumnProps {
  callId: string;
  className?: string;
}

/** Transcript tab — full call record. */
export function PostDcTranscriptColumn({ callId, className }: PostDcTranscriptColumnProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <PostDcTranscriptPanel callId={callId} />
    </div>
  );
}
