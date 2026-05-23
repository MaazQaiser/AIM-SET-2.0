"use client";

import { Activity, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { BantSignal } from "@/lib/live-types";

const dimStyles: Record<
  BantSignal["dimension"],
  { label: string; className: string; dot: string }
> = {
  budget: {
    label: "Budget",
    className: "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/30",
    dot: "bg-emerald-500",
  },
  authority: {
    label: "Authority",
    className: "border-violet-200/80 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/30",
    dot: "bg-violet-500",
  },
  need: {
    label: "Need",
    className: "border-sky-200/80 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/30",
    dot: "bg-sky-500",
  },
  timeline: {
    label: "Timeline",
    className: "border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/30",
    dot: "bg-amber-500",
  },
};

interface FocusAreasBarProps {
  areas: string[];
  intentLabel?: string;
  bantSignals?: BantSignal[];
}

export function FocusAreasBar({ areas, intentLabel, bantSignals = [] }: FocusAreasBarProps) {
  const recentSignals = bantSignals.slice(-6);
  if (areas.length === 0 && !intentLabel && recentSignals.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-muted/40 via-card to-muted/20 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Live signals
        </span>
        {intentLabel && (
          <Badge variant="secondary" className="text-[10px] font-normal capitalize ml-auto shrink-0">
            <Target className="h-3 w-3 mr-1 inline" aria-hidden />
            {intentLabel.includes("_") ? intentLabel.replace(/_/g, " ") : intentLabel}
          </Badge>
        )}
      </div>

      {(areas.length > 0 || recentSignals.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
          {areas.map((area) => (
            <span
              key={area}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground shadow-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {area}
            </span>
          ))}
          {recentSignals.map((s) => {
            const style = dimStyles[s.dimension];
            return (
              <span
                key={s.id}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] shadow-sm",
                  style.className
                )}
                title={s.label}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} aria-hidden />
                <span className="font-medium text-foreground/90">{style.label}</span>
                <span className="text-muted-foreground truncate max-w-[140px]">{s.label}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
