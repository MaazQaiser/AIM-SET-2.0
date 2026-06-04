"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { DemoTranscriptPlayer } from "@/components/live/demo-transcript-player";
import { RecallBotLauncher } from "@/components/live/recall-bot-launcher";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PodAvatars({ pod }: { pod: Call["pod"] }) {
  if (!pod?.length) return null;
  return (
    <div className="flex -space-x-1.5">
      {pod.slice(0, 3).map((member) => (
        <span
          key={member.id}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-semibold text-primary"
          title={member.name}
        >
          {member.initials}
        </span>
      ))}
    </div>
  );
}

export interface LiveCallPageHeaderProps {
  callId: string;
  call?: Call | null;
  accountName: string;
  leadName?: string;
  elapsedSeconds: number;
  isConnected: boolean;
  hasReview: boolean;
  sentimentLabel: string;
  sentimentTone: "positive" | "neutral" | "negative";
}

export function LiveCallPageHeader({
  callId,
  call,
  accountName,
  leadName,
  elapsedSeconds,
  isConnected,
  hasReview,
  sentimentLabel,
  sentimentTone,
}: LiveCallPageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/50 bg-background/75 px-6 py-4 backdrop-blur-md sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Back to call brief"
          >
            <Link href={`/calls/${callId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="type-headline truncate text-foreground">{accountName}</h1>
              <Badge variant="live" className="shrink-0 text-xs">
                Live
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-body-sm text-muted-foreground">
              {leadName && <span className="font-semibold text-foreground/90">{leadName}</span>}
              <span className="inline-flex items-center gap-1.5 font-mono text-destructive">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" aria-hidden />
                REC {formatElapsed(elapsedSeconds)}
              </span>
              {!isConnected && (
                <span className="text-muted-foreground">Connecting…</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <PodAvatars pod={call?.pod ?? []} />
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              sentimentTone === "positive" && "bg-success/10 text-success",
              sentimentTone === "negative" && "bg-destructive/10 text-destructive",
              sentimentTone === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {sentimentLabel}
          </span>
          <RecallBotLauncher callId={callId} meetingUrl={call?.meetingUrl} />
          <DemoTranscriptPlayer callId={callId} isConnected={isConnected} />
          <CallWrapUpActions
            callId={callId}
            accountName={accountName}
            hasReview={hasReview}
            showLiveLink={false}
            variant="compact"
          />
        </div>
      </div>
    </header>
  );
}
