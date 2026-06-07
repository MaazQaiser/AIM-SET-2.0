"use client";

import { TranscriptViewer } from "@/components/transcript-viewer";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { PostDcPageLoader } from "@/components/layout/page-loaders";
import { useCallTranscript } from "@/lib/data/hooks";
import { MessageSquareText } from "lucide-react";

interface PostDcTranscriptPanelProps {
  callId: string;
}

export function PostDcTranscriptPanel({ callId }: PostDcTranscriptPanelProps) {
  const { data: events = [], isLoading, isError } = useCallTranscript(callId);

  if (isLoading) {
    return <PostDcPageLoader />;
  }

  if (isError || events.length === 0) {
    return (
      <BriefDetailCard title="Call transcript" icon={MessageSquareText}>
        <p className="type-body text-muted-foreground">
          No transcript captured — run wrap-up after a live call or replay the demo transcript from
          the live cockpit.
        </p>
      </BriefDetailCard>
    );
  }

  return (
    <BriefDetailCard title="Call transcript" icon={MessageSquareText}>
      <TranscriptViewer events={events} isLive={false} className="max-h-[min(70vh,640px)]" />
    </BriefDetailCard>
  );
}
