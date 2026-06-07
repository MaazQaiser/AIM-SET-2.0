"use client";

import {
  formatSentimentScore,
  resolveCustomerSentimentCue,
  resolveSalesRepToneCue,
  scoreEmoji,
  scoreToTone,
  shiftDirectionEmoji,
  shiftEmoji,
  toneEmoji,
  type SentimentScore,
} from "@/lib/live/sentiment-display";
import type { CustomerSentimentCue, SalesRepToneCue, SentimentShift } from "@/types";
import { cn } from "@/lib/cn";

interface SentimentDisplayPanelProps {
  aeScore: SentimentScore;
  salesRepTone?: SalesRepToneCue | null;
  customerScore: SentimentScore;
  customerSentiment?: CustomerSentimentCue | null;
  shift?: SentimentShift | null;
  className?: string;
}

function SentimentChip({
  label,
  score,
  value,
  helper,
  toneOverride,
}: {
  label: string;
  score: SentimentScore;
  value?: string;
  helper?: string;
  toneOverride?: Exclude<ReturnType<typeof scoreToTone>, null>;
}) {
  const tone = toneOverride ?? scoreToTone(score) ?? "neutral";
  const scoreIcon = scoreEmoji(score);
  const toneIcon = toneEmoji(tone);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-2 min-w-0",
        tone === "positive" && "border-success/30 bg-success/5",
        tone === "negative" && "border-destructive/30 bg-destructive/5",
        tone === "neutral" && "border-border bg-muted/30"
      )}
    >
      {scoreIcon && (
        <span className="text-xl leading-none" aria-hidden>
          {scoreIcon}
        </span>
      )}
      <div className="min-w-0">
        <p className="type-caption font-medium text-muted-foreground">
          {label}
        </p>
        <p className="type-label text-foreground leading-snug">
          {[toneIcon, value ?? formatSentimentScore(score)].filter(Boolean).join(" ")}
        </p>
        {helper && (
          <p className="mt-0.5 type-caption leading-snug text-muted-foreground">{helper}</p>
        )}
      </div>
    </div>
  );
}

export function SentimentDisplayPanel({
  aeScore,
  salesRepTone,
  customerScore,
  customerSentiment,
  shift,
  className,
}: SentimentDisplayPanelProps) {
  const repToneCue = resolveSalesRepToneCue(aeScore, salesRepTone);
  const customerCue = resolveCustomerSentimentCue(customerScore, customerSentiment);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SentimentChip
          label="Sales rep tone"
          score={aeScore}
          value={repToneCue.label}
          helper={repToneCue.guidance}
          toneOverride={repToneCue.tone}
        />
        <SentimentChip
          label="Customer"
          score={customerScore}
          value={customerCue.label}
          helper={customerCue.guidance}
          toneOverride={customerCue.tone}
        />
      </div>
      {shift && (
        <output
          className={cn(
            "rounded-md border px-2.5 py-2 type-label",
            shift.direction === "negative"
              ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/25"
              : "border-success/30 bg-success/5"
          )}
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
        </output>
      )}
    </div>
  );
}
