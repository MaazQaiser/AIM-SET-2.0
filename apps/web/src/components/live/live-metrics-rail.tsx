"use client";

import { useMemo } from "react";
import { filterKeywordCounts } from "@/lib/live/keyword-filter";
import { scoreToTone } from "@/lib/live/sentiment-display";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { KeywordStats, TranscriptEvent } from "@/types";
import { LiveSubsectionHeader } from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";

const BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;

type BantKey = (typeof BANT_KEYS)[number];

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
  sentimentCustomer: number;
  openGaps: string[];
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
      .map((i) => [i.id, i.evidence?.[0]?.snippet ?? ""])
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {BANT_KEYS.map((key) => {
        const status = checklist.bant[key] ?? "unknown";
        const variant = bantTileVariant(status, key);
        const evidence = evidenceById[key];
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
            {evidence && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-snug">
                {evidence}
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
  const bars = useMemo(() => {
    const withSentiment = transcript
      .filter((e) => e.speakerRole === "customer" && e.sentiment)
      .slice(-12);
    if (withSentiment.length >= 3) {
      return withSentiment.map((e) => ({
        tone: e.sentiment as "positive" | "neutral" | "negative",
      }));
    }
    const tone = scoreToTone(customerScore);
    const fill =
      tone === "positive" ? 0.85 : tone === "negative" ? 0.35 : 0.55;
    return Array.from({ length: 8 }, (_, i) => ({
      tone: i / 7 <= fill ? tone : ("neutral" as const),
    }));
  }, [transcript, customerScore]);

  return (
    <div className="flex items-end gap-1 h-8">
      {bars.map((bar, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-sm min-w-[4px]",
            bar.tone === "positive" && "bg-success",
            bar.tone === "negative" && "bg-destructive/70",
            bar.tone === "neutral" && "bg-muted-foreground/25"
          )}
          style={{ height: `${40 + (i / Math.max(bars.length - 1, 1)) * 60}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function LiveMetricsRail({
  checklist,
  keywordStats,
  keywords,
  transcript,
  sentimentCustomer,
  openGaps,
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
    </div>
  );
}
