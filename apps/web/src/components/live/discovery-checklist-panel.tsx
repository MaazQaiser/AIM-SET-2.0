"use client";

import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { useState } from "react";
import { BANTScorecard } from "@/components/bant-scorecard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { DiscoveryChecklistState } from "@dc-copilot/types";

const statusLabel: Record<string, string> = {
  pending: "Open",
  partial: "Partial",
  confirmed: "Done",
  not_applicable: "N/A",
};

interface DiscoveryChecklistPanelProps {
  state: DiscoveryChecklistState | null;
  className?: string;
}

export function DiscoveryChecklistPanel({ state, className }: DiscoveryChecklistPanelProps) {
  const [showSecondary, setShowSecondary] = useState(false);

  if (!state) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
        <p className="text-xs text-muted-foreground">
          Discovery checklist will populate when the call stream connects.
        </p>
      </div>
    );
  }

  const bantPct = Math.round(state.bantCoverage * 100);
  const allPct = Math.round(state.coverage * 100);
  const secondary = state.items.filter((i) => i.tier === "secondary");
  const bantComplete = bantPct >= 100;

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Discovery coverage
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CoverageRing percent={bantPct} label="BANT" />
          <Badge variant={bantComplete ? "success" : "secondary"} className="text-[10px]">
            {bantPct}% BANT
          </Badge>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <BANTScorecard bant={state.bant} compact layout="row" />

        {state.openGaps.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Open: {state.openGaps.map((g) => g.replace(/_/g, " ")).join(", ")}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground">Overall qualification {allPct}%</p>

        {secondary.length > 0 && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs w-full justify-between"
              onClick={() => setShowSecondary((v) => !v)}
            >
              Secondary items ({secondary.filter((i) => i.status === "confirmed").length}/
              {secondary.length})
              {showSecondary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {showSecondary && (
              <ul className="mt-2 space-y-1">
                {secondary.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <span className="truncate text-foreground">{item.label}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {statusLabel[item.status] ?? item.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverageRing({ percent, label }: { percent: number; label: string }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div
      className="relative h-9 w-9 shrink-0"
      title={`${label} ${percent}%`}
      aria-label={`${label} coverage ${percent} percent`}
    >
      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" className="stroke-muted" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium">
        {percent}
      </span>
    </div>
  );
}
