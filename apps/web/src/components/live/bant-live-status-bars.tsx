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
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      {BANT_KEYS.map((key) => {
        const status = checklist?.bant[key] ?? "unknown";
        const tone = bantBarTone(status, key);
        return (
          <div key={key} className="flex items-center justify-center">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full border type-caption font-semibold transition-colors",
                tone === "complete" && "border-success bg-success text-success-foreground",
                tone === "partial" && "border-warning/50 bg-warning/20 text-warning-foreground",
                tone === "open" && "border-border bg-muted/70 text-muted-foreground"
              )}
              title={`${bantLabels[key]}: ${bantStatusLabel(status, key)}`}
            >
              <span aria-hidden>
                {bantShort[key]}
              </span>
              <span className="sr-only">
                {bantLabels[key]}: {bantStatusLabel(status, key)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
