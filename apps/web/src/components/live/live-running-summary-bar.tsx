"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { LiveCollapsibleSection } from "@/components/live/live-collapsible-section";
import {
  LiveColumnHeader,
  liveColumnContentPadding,
} from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { CallIntent, PainSignal, TranscriptEvent } from "@/types";

interface LiveRunningSummaryBarProps {
  accountName: string;
  leadName?: string;
  intent?: CallIntent | null;
  intentLabel?: string;
  pains: PainSignal[];
  checklist: DiscoveryChecklistState | null;
  transcript: TranscriptEvent[];
  className?: string;
  /** Inside the live copilot column (top), not the full-width footer bar */
  embedded?: boolean;
}

function buildSummary({
  accountName,
  leadName,
  intent,
  intentLabel,
  pains,
  checklist,
  transcript,
}: Omit<LiveRunningSummaryBarProps, "className">): string {
  const parts: string[] = [];

  const contact = leadName ? `${leadName} at ${accountName}` : accountName;
  parts.push(`Live discovery with ${contact}.`);

  const intentDisplay =
    intent?.display ?? (intent?.label ?? intentLabel)?.replace(/_/g, " ");
  if (intentDisplay) {
    parts.push(`Primary intent: ${intentDisplay}.`);
  }

  if (pains.length > 0) {
    const latest = pains[pains.length - 1]?.text;
    if (latest) {
      parts.push(`Latest pain signal: "${latest.slice(0, 120)}${latest.length > 120 ? "…" : ""}".`);
    }
  }

  if (checklist && typeof checklist.bantCoverage === "number") {
    const bantPct = Math.round(checklist.bantCoverage * 100);
    parts.push(`BANT coverage at ${bantPct}%.`);
    const openGaps = Array.isArray(checklist.openGaps) ? checklist.openGaps : [];
    if (openGaps.length > 0) {
      parts.push(
        `Still to cover: ${openGaps.map((g) => g.replace(/_/g, " ")).join(", ")}.`
      );
    }
  }

  const lastCustomer = [...transcript].reverse().find((e) => e.speakerRole === "customer");
  if (lastCustomer?.text) {
    parts.push(
      `Most recent customer comment: "${lastCustomer.text.slice(0, 100)}${lastCustomer.text.length > 100 ? "…" : ""}".`
    );
  }

  return parts.join(" ");
}

export function LiveRunningSummaryBar({
  accountName,
  leadName,
  intent,
  intentLabel,
  pains,
  checklist,
  transcript,
  className,
  embedded = false,
}: LiveRunningSummaryBarProps) {
  const summary = buildSummary({
    accountName,
    leadName,
    intent,
    intentLabel,
    pains,
    checklist,
    transcript,
  });

  const [summaryOpen, setSummaryOpen] = useState(true);

  if (embedded) {
    return (
      <div
        className={cn(
          "app-card shrink-0 overflow-hidden px-3 py-2",
          summaryOpen && "flex h-[146px] flex-col",
          className
        )}
      >
        <LiveCollapsibleSection
          inset
          title="Running summary"
          defaultOpen
          className={summaryOpen ? "flex min-h-0 flex-1 flex-col" : undefined}
          panelClassName={
            summaryOpen ? "min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]" : undefined
          }
          onOpenChange={setSummaryOpen}
        >
          <p className="pt-1 text-sm leading-snug text-foreground break-words">{summary}</p>
        </LiveCollapsibleSection>
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
