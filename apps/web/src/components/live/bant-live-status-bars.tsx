"use client";

import type { DiscoveryChecklistState } from "@dc-copilot/types";
import { cn } from "@/lib/cn";

const BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;

type BantKey = (typeof BANT_KEYS)[number];

const bantLabels: Record<BantKey, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

const bantShort: Record<BantKey, string> = {
  budget: "B",
  authority: "A",
  need: "N",
  timeline: "T",
};

function bantStatusLabel(status: string, key: BantKey): string {
  if (status === "confirmed") {
    return key === "authority" ? "Identified" : "Confirmed";
  }
  if (status === "partial") return "Partial";
  if (key === "timeline" && status === "unknown") return "Urgent";
  return "Open";
}

function bantBarTone(
  status: string,
  key: BantKey
): "complete" | "partial" | "open" {
  if (status === "confirmed") return "complete";
  if (status === "partial") return "partial";
  if (key === "timeline" && status === "unknown") return "open";
  return "open";
}

export function BantLiveStatusBars({
  checklist,
  className,
}: {
  checklist: DiscoveryChecklistState | null;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-end gap-2 shrink-0", className)}
      role="group"
      aria-label="BANT live status"
    >
      {BANT_KEYS.map((key) => {
        const status = checklist?.bant[key] ?? "unknown";
        const tone = bantBarTone(status, key);
        return (
          <div key={key} className="flex min-w-[2.25rem] flex-col items-center gap-1">
            <div
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                tone === "complete" && "bg-success",
                tone === "partial" && "bg-success/40",
                tone === "open" && "bg-muted"
              )}
              title={`${bantLabels[key]}: ${bantStatusLabel(status, key)}`}
            />
            <span className="text-[9px] font-semibold text-muted-foreground">
              {bantShort[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
