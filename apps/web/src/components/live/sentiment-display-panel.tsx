"use client";

import {
  formatSentimentScore,
  scoreEmoji,
  scoreToTone,
  shiftDirectionEmoji,
  shiftEmoji,
  toneEmoji,
} from "@/lib/live/sentiment-display";
import type { SentimentShift } from "@/types";
import { cn } from "@/lib/cn";

interface SentimentDisplayPanelProps {
  aeScore: number;
  customerScore: number;
  shift?: SentimentShift | null;
  className?: string;
}

function SentimentChip({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const tone = scoreToTone(score);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-2 min-w-0",
        tone === "positive" && "border-success/30 bg-success/5",
        tone === "negative" && "border-destructive/30 bg-destructive/5",
        tone === "neutral" && "border-border bg-muted/30"
      )}
    >
      <span className="text-xl leading-none" aria-hidden>
        {scoreEmoji(score)}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-medium text-foreground truncate">
          {toneEmoji(tone)} {formatSentimentScore(score)}
        </p>
      </div>
    </div>
  );
}

export function SentimentDisplayPanel({
  aeScore,
  customerScore,
  shift,
  className,
}: SentimentDisplayPanelProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        <SentimentChip label="AE" score={aeScore} />
        <SentimentChip label="Customer" score={customerScore} />
      </div>
      {shift && (
        <div
          className={cn(
            "rounded-md border px-2.5 py-2 text-xs",
            shift.direction === "negative"
              ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/25"
              : "border-success/30 bg-success/5"
          )}
          role="status"
        >
          <p className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
            <span aria-hidden>
              {shiftEmoji(shift.direction)} {shiftDirectionEmoji(shift.direction)}
            </span>
            <span>
              Sentiment shift{" "}
              {shift.direction === "negative" ? "↘️ cooling" : "↗️ warming"}
            </span>
          </p>
          {shift.message && (
            <p className="text-muted-foreground mt-1 leading-snug">{shift.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
