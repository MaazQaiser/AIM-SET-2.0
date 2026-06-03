"use client";

import type { BantSignal } from "@/lib/live-types";
import { cn } from "@/lib/cn";
import { formatBudgetSignalLabel, formatBudgetUsd, hasBudgetAmount } from "@/lib/currency-format";

interface SignalLogProps {
  signals: BantSignal[];
}

const dimConfig: Record<
  BantSignal["dimension"],
  { label: string; emoji: string; accent: string }
> = {
  budget: { label: "Budget", emoji: "💰", accent: "border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/25" },
  authority: {
    label: "Authority",
    emoji: "👤",
    accent: "border-violet-300/60 bg-violet-50/50 dark:bg-violet-950/25",
  },
  need: { label: "Need", emoji: "🎯", accent: "border-sky-300/60 bg-sky-50/50 dark:bg-sky-950/25" },
  timeline: {
    label: "Timeline",
    emoji: "📅",
    accent: "border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/25",
  },
};

export function SignalLog({ signals }: SignalLogProps) {
  if (signals.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        BANT signals will appear as the conversation progresses.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {[...signals].reverse().slice(0, 8).map((s) => {
        const cfg = dimConfig[s.dimension];
        const label =
          s.dimension === "budget" ? formatBudgetSignalLabel(s.label, s.value) : s.label;
        const value = s.dimension === "budget" ? formatBudgetUsd(s.value) : s.value;
        const shouldAppendValue =
          Boolean(value) && !label.includes(value ?? "") && !hasBudgetAmount(label);
        return (
          <li
            key={s.id}
            className={cn(
              "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
              cfg.accent
            )}
          >
            <span className="text-base leading-none shrink-0" aria-hidden>
              {cfg.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{cfg.label}</p>
              <p className="text-muted-foreground leading-snug mt-0.5">
                {label}
                {shouldAppendValue ? `: ${value}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
