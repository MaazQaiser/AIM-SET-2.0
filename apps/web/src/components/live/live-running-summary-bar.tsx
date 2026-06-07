"use client";

import { FileText } from "lucide-react";
import { AiGradientText } from "@/components/ai-gradient-text";
import { TypingText } from "@/components/typing-text";
import {
  LiveColumnHeader,
  liveColumnContentPadding,
} from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";
import { buildRunningSummaryLines } from "@/lib/live/build-running-summary-lines";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { CallIntent, TranscriptEvent } from "@/types";

interface LiveRunningSummaryBarProps {
  accountName: string;
  leadName?: string;
  intent?: CallIntent | null;
  intentLabel?: string;
  checklist: DiscoveryChecklistState | null;
  transcript: TranscriptEvent[];
  className?: string;
  /** Plain text at top of live copilot chat — no card or border */
  embedded?: boolean;
}

export function LiveRunningSummaryBar({
  accountName,
  leadName,
  intent,
  intentLabel,
  checklist,
  transcript,
  className,
  embedded = false,
}: LiveRunningSummaryBarProps) {
  const summary = buildRunningSummaryLines({
    accountName,
    leadName,
    intent,
    intentLabel,
    checklist,
    transcript,
  }).join(" ");

  if (embedded) {
    return (
      <div className={cn("shrink-0", className)} data-testid="running-summary">
        <AiGradientText as="p" className="mb-1.5 text-[10px] font-semibold">
          Running summary
        </AiGradientText>
        <p className="text-sm leading-relaxed text-foreground break-words">
          <TypingText text={summary} />
        </p>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0", className)}>
      <LiveColumnHeader
        icon={FileText}
        title="Running summary"
        className="border-t border-border"
      />
      <div className={liveColumnContentPadding}>
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
      </div>
    </div>
  );
}
