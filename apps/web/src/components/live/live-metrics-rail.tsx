"use client";

import { useMemo } from "react";
import { filterKeywordCounts } from "@/lib/live/keyword-filter";
import { formatSentimentScore, scoreToTone } from "@/lib/live/sentiment-display";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";
import type { KeywordStats, SentimentShift, SuggestionLogEntry, TranscriptEvent } from "@/types";
import { LiveSubsectionHeader } from "@/components/live/live-column-header";
import { SignalLog } from "@/components/live/signal-log";
import { SuggestionLog } from "@/components/live/suggestion-log";
import { cn } from "@/lib/cn";
import { formatBudgetUsd } from "@/lib/currency-format";

const BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;

type BantKey = (typeof BANT_KEYS)[number];
type SentimentTone = "positive" | "neutral" | "negative";
type SentimentBar = {
  id: string;
  tone: SentimentTone;
  current?: boolean;
};

const bantLabels: Record<BantKey, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

function bantStatusLabel(status: string, key: BantKey): string {
  if (status === "confirmed") {
    return key === "authority" ? "Identified" : "Confirmed";
  }
  if (status === "partial") return "Partially qualified";
  if (key === "timeline" && status === "unknown") return "Urgent";
  return "Open";
}

function bantTileVariant(status: string, key: BantKey): "good" | "warn" | "neutral" {
  if (status === "confirmed") return "good";
  if (status === "partial") return "neutral";
  if (key === "timeline" && status === "unknown") return "warn";
  return "neutral";
}

interface LiveMetricsRailProps {
  checklist: DiscoveryChecklistState | null;
  keywordStats: KeywordStats | null;
  keywords: string[];
  transcript: TranscriptEvent[];
  sentimentAE: number;
  sentimentCustomer: number;
  sentimentShift: SentimentShift | null;
  openGaps: string[];
  bantSignals: BantSignal[];
  suggestionLog: SuggestionLogEntry[];
  className?: string;
}

function BantLiveTiles({ checklist }: { checklist: DiscoveryChecklistState | null }) {
  if (!checklist) {
    return (
      <p className="text-xs text-muted-foreground">
        BANT signals will appear as the conversation progresses.
      </p>
    );
  }

  const evidenceById = Object.fromEntries(
    checklist.items
      .filter((i) => i.tier === "bant")
      .map((i) => {
        const evidence = i.evidence?.[i.evidence.length - 1];
        return [
          i.id,
          {
            text: evidence?.value || evidence?.snippet || "",
            sentiment: evidence?.sentiment,
          },
        ];
      })
  ) as Record<string, { text: string; sentiment?: string }>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {BANT_KEYS.map((key) => {
        const status = checklist.bant[key] ?? "unknown";
        const variant = bantTileVariant(status, key);
        const evidence = evidenceById[key];
        const evidenceText =
          key === "budget" && evidence?.text ? formatBudgetUsd(evidence.text) : evidence?.text;
        return (
          <div
            key={key}
            className={cn(
              "rounded-lg border px-2.5 py-2 min-w-0",
              variant === "good" && "border-success/30 bg-success/5",
              variant === "warn" && "border-destructive/25 bg-destructive/5",
              variant === "neutral" && "border-border bg-muted/20"
            )}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {bantLabels[key]}
            </p>
            <p
              className={cn(
                "text-[10px] font-bold uppercase mt-0.5",
                variant === "good" && "text-success",
                variant === "warn" && "text-destructive",
                variant === "neutral" && "text-foreground"
              )}
            >
              {bantStatusLabel(status, key)}
            </p>
            {evidenceText && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-snug">
                {evidence.sentiment === "negative" ? "Concern: " : ""}
                {evidenceText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SentimentBars({
  transcript,
  customerScore,
}: {
  transcript: TranscriptEvent[];
  customerScore: number;
}) {
  const bars = useMemo<SentimentBar[]>(() => {
    const currentTone = scoreToTone(customerScore);
    const withSentiment = transcript
      .filter((e) => e.speakerRole === "customer" && e.sentiment)
      .slice(-12);
    if (withSentiment.length > 0) {
      const transcriptBars: SentimentBar[] = withSentiment.slice(-7).map((e, index) => ({
        id: e.id || `${e.timestamp}-${index}`,
        tone: e.sentiment as SentimentTone,
      }));
      return [
        ...transcriptBars,
        {
          id: `current-${currentTone}-${Math.round(customerScore * 100)}`,
          tone: currentTone,
          current: true,
        },
      ];
    }
    const fill = currentTone === "positive" ? 0.85 : currentTone === "negative" ? 0.35 : 0.55;
    return Array.from({ length: 8 }, (_, i): SentimentBar => ({
      id: `fallback-${i}`,
      tone: i / 7 <= fill ? currentTone : ("neutral" as const),
      current: i === 7,
    }));
  }, [transcript, customerScore]);

  return (
    <div className="flex items-end gap-1 h-8">
      {bars.map((bar, i) => (
        <div
          key={bar.id}
          className={cn(
            "flex-1 rounded-sm min-w-[4px]",
            bar.tone === "positive" && "bg-success",
            bar.tone === "negative" && "bg-destructive/70",
            bar.tone === "neutral" && "bg-muted-foreground/25",
            bar.current && "ring-1 ring-foreground/20"
          )}
          style={{ height: `${40 + (i / Math.max(bars.length - 1, 1)) * 60}%` }}
          data-sentiment-tone={bar.tone}
          data-current-sentiment={bar.current ? "true" : undefined}
          aria-hidden
        />
      ))}
    </div>
  );
}

function scoreTextClass(score: number): string {
  const tone = scoreToTone(score);
  if (tone === "positive") return "text-success";
  if (tone === "negative") return "text-destructive";
  return "text-muted-foreground";
}

function scoreTileClass(score: number): string {
  const tone = scoreToTone(score);
  if (tone === "positive") return "border-success/35 bg-success/5";
  if (tone === "negative") return "border-destructive/35 bg-destructive/5";
  return "border-border bg-muted/20";
}

function SentimentScoreRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const tone = scoreToTone(score);
  return (
    <div
      className={cn("min-w-0 rounded-md border px-2 py-1.5", scoreTileClass(score))}
      data-sentiment-label={label.toLowerCase()}
      data-sentiment-tone={tone}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("truncate text-[11px] font-semibold", scoreTextClass(score))}>
        {formatSentimentScore(score)}
      </p>
    </div>
  );
}

export function LiveMetricsRail({
  checklist,
  keywordStats,
  keywords,
  transcript,
  sentimentAE,
  sentimentCustomer,
  sentimentShift,
  openGaps,
  bantSignals,
  suggestionLog,
  className,
}: LiveMetricsRailProps) {
  const keywordPills = useMemo(() => {
    const fromStats = filterKeywordCounts(keywordStats?.global_top ?? []).map((k) => k.term);
    const merged = [...new Set([...fromStats, ...keywords])];
    return merged.slice(0, 8);
  }, [keywordStats, keywords]);

  const uncovered = useMemo(() => {
    const gapLabels = openGaps.map((g) => {
      const item = checklist?.items.find((i) => i.id === g);
      return item?.suggestedQuestion ?? g.replace(/_/g, " ");
    });
    return gapLabels.slice(0, 6);
  }, [openGaps, checklist]);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <section>
        <LiveSubsectionHeader title="BANT live" />
        <BantLiveTiles checklist={checklist} />
      </section>

      <section>
        <LiveSubsectionHeader title="BANT signals" />
        <SignalLog signals={bantSignals} />
      </section>

      <section>
        <LiveSubsectionHeader title="Keywords" />
        {keywordPills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {keywordPills.map((term) => (
              <span
                key={term}
                className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                {term}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Keywords appear as topics emerge.</p>
        )}
      </section>

      <section>
        <LiveSubsectionHeader title="Sentiment" />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <SentimentScoreRow label="Customer" score={sentimentCustomer} />
          <SentimentScoreRow label="AE" score={sentimentAE} />
        </div>
        {sentimentShift && (
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
            Shift:{" "}
            <span className={scoreTextClass(sentimentShift.to_score)}>
              {sentimentShift.message ||
                (sentimentShift.direction === "negative"
                  ? "Customer concern rising"
                  : "Customer confidence improving")}
            </span>
          </p>
        )}
        <SentimentBars transcript={transcript} customerScore={sentimentCustomer} />
      </section>

      <section>
        <LiveSubsectionHeader title="Still uncovered" />
        {uncovered.length > 0 ? (
          <ul className="space-y-1.5 text-xs text-foreground">
            {uncovered.map((item) => (
              <li key={item} className="flex gap-2 leading-snug">
                <span className="text-muted-foreground shrink-0">•</span>
                <span className="capitalize">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Discovery gaps will list here.</p>
        )}
      </section>

      {suggestionLog.length > 0 && (
        <section>
          <LiveSubsectionHeader title="AI suggestion log" />
          <SuggestionLog entries={suggestionLog} compact />
        </section>
      )}
    </div>
  );
}
