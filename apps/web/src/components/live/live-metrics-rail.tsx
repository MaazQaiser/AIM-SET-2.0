"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { buildLiveKeywordEntries } from "@/lib/live/keyword-filter";
import { formatSentimentScore, scoreToTone } from "@/lib/live/sentiment-display";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { KeywordStats, SentimentShift, TranscriptEvent } from "@/types";
import { LiveCollapsibleSection } from "@/components/live/live-collapsible-section";
import { LiveSubsectionHeader } from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";

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

export function bantLiveSummary(checklist: DiscoveryChecklistState | null): string {
  if (!checklist) return "Signals appear as the conversation progresses";
  return BANT_KEYS.map((key) => {
    const status = checklist.bant[key] ?? "unknown";
    return `${bantLabels[key]} ${bantStatusLabel(status, key)}`;
  }).join(" · ");
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
  /** stack | accordions | copilot-panel (sticky metrics + scrollable body) */
  layout?: "stack" | "accordions" | "copilot-panel";
  /** BANT is shown in LiveCopilotHeader — omit duplicate accordion */
  bantInHeader?: boolean;
  /** Rendered in the scroll region when layout is copilot-panel */
  panelChildren?: React.ReactNode;
  className?: string;
}

export function BantLiveTiles({ checklist }: { checklist: DiscoveryChecklistState | null }) {
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
            {evidence?.text && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-snug">
                {evidence.sentiment === "negative" ? "Concern: " : ""}
                {evidence.text}
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
  compact = false,
}: {
  transcript: TranscriptEvent[];
  customerScore: number;
  compact?: boolean;
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
    <div
      className={cn(
        "flex items-end",
        compact ? "h-4 min-w-[5rem] max-w-[9rem] flex-1 gap-0.5" : "h-8 w-full gap-1"
      )}
    >
      {bars.map((bar, i) => (
        <div
          key={bar.id}
          className={cn(
            "flex-1 rounded-sm",
            compact ? "min-w-[3px]" : "min-w-[4px]",
            bar.tone === "positive" && "bg-success",
            bar.tone === "negative" && "bg-destructive/70",
            bar.tone === "neutral" && "bg-warning/60",
            bar.current && "ring-1 ring-foreground/20"
          )}
          style={{
            height: compact
              ? `${50 + (i / Math.max(bars.length - 1, 1)) * 50}%`
              : `${40 + (i / Math.max(bars.length - 1, 1)) * 60}%`,
          }}
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
  return "text-warning";
}

function scoreTileClass(score: number): string {
  const tone = scoreToTone(score);
  if (tone === "positive") return "border-success/35 bg-success/5";
  if (tone === "negative") return "border-destructive/35 bg-destructive/5";
  return "border-warning/35 bg-warning/5";
}

function SentimentScoreChip({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const tone = scoreToTone(score);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border py-0.5 pl-2 pr-2 text-[11px]",
        scoreTileClass(score)
      )}
      data-sentiment-label={label.toLowerCase()}
      data-sentiment-tone={tone}
    >
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", scoreTextClass(score))}>
        {formatSentimentScore(score)}
      </span>
    </span>
  );
}

function KeywordPills({ keywords }: { keywords: { term: string; count: number }[] }) {
  return (
    <>
      {keywords.map(({ term, count }) => (
        <span
          key={term}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 py-0.5 pl-2 pr-1.5 text-[11px] font-medium text-primary"
        >
          <span className="whitespace-nowrap">{term}</span>
          <span
            className="min-w-[1.125rem] shrink-0 rounded-full bg-primary/15 px-1 text-center text-[10px] font-semibold tabular-nums text-primary"
            aria-label={`${count} mentions`}
          >
            {count}
          </span>
        </span>
      ))}
    </>
  );
}

function KeywordsRow({ keywords }: { keywords: { term: string; count: number }[] }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs font-semibold text-foreground">Keywords</span>
      {keywords.length > 0 ? (
        <div className="min-w-0 flex-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          <div className="flex w-max flex-nowrap items-center justify-start gap-1.5">
            <KeywordPills keywords={keywords} />
          </div>
        </div>
      ) : (
        <p className="min-w-0 text-xs text-muted-foreground">Topics appear as the call progresses.</p>
      )}
    </div>
  );
}

function SentimentSection({
  transcript,
  sentimentAE,
  sentimentCustomer,
  sentimentShift,
  className,
}: {
  transcript: TranscriptEvent[];
  sentimentAE: number;
  sentimentCustomer: number;
  sentimentShift: SentimentShift | null;
  className?: string;
}) {
  return (
    <div className={cn("px-3 py-2.5", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-foreground">Sentiment</span>
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          <SentimentScoreChip label="Customer" score={sentimentCustomer} />
          <SentimentScoreChip label="AE" score={sentimentAE} />
        </div>
        <SentimentBars
          compact
          transcript={transcript}
          customerScore={sentimentCustomer}
        />
      </div>
      {sentimentShift && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Shift:{" "}
          <span className={scoreTextClass(sentimentShift.to_score)}>
            {sentimentShift.message ||
              (sentimentShift.direction === "negative"
                ? "Customer concern rising"
                : "Customer confidence improving")}
          </span>
        </p>
      )}
    </div>
  );
}

function UncoveredBlock({ uncovered }: { uncovered: string[] }) {
  if (uncovered.length > 0) {
    return (
      <ul className="space-y-1.5 text-xs text-foreground">
        {uncovered.map((item) => (
          <li key={item} className="flex gap-2 leading-snug">
            <span className="text-muted-foreground shrink-0">•</span>
            <span className="capitalize">{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-xs text-muted-foreground">Discovery gaps will list here.</p>;
}

function StillUncoveredStickyTrigger({
  uncovered,
  open,
  onToggle,
}: {
  uncovered: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const variant = uncovered.length > 0 ? "attention" : "default";

  return (
    <div
      className={cn(
        "shrink-0",
        variant === "attention" && "bg-amber-50/40 dark:bg-amber-950/20"
      )}
    >
      <button
        type="button"
        className="flex w-full shrink-0 items-start gap-2 rounded-none px-5 py-2 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Still uncovered</span>
            {uncovered.length > 0 && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                {uncovered.length}
              </Badge>
            )}
          </div>
        </div>
      </button>
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
  layout = "stack",
  bantInHeader = false,
  panelChildren,
  className,
}: LiveMetricsRailProps) {
  const keywordEntries = useMemo(
    () => buildLiveKeywordEntries(keywordStats, keywords, transcript),
    [keywordStats, keywords, transcript]
  );

  const uncovered = useMemo(() => {
    const gapLabels = openGaps.map((g) => {
      const item = checklist?.items.find((i) => i.id === g);
      return item?.suggestedQuestion ?? g.replace(/_/g, " ");
    });
    return gapLabels.slice(0, 6);
  }, [openGaps, checklist]);

  const bantSummary = bantLiveSummary(checklist);
  const [uncoveredOpen, setUncoveredOpen] = useState(uncovered.length > 0);

  if (layout === "copilot-panel") {
    return (
      <div
        className={cn(
          "flex min-h-0 h-0 flex-1 flex-col overflow-hidden border-y border-border/60 bg-card/50",
          className
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
          <div className="sticky top-0 z-10 shrink-0 divide-y divide-border/60 border-b border-border/60 bg-card/95 backdrop-blur-sm">
            <div className="px-5 py-2.5">
              <KeywordsRow keywords={keywordEntries} />
            </div>
            <SentimentSection
              className="px-5 py-2.5"
              transcript={transcript}
              sentimentAE={sentimentAE}
              sentimentCustomer={sentimentCustomer}
              sentimentShift={sentimentShift}
            />
            <StillUncoveredStickyTrigger
              uncovered={uncovered}
              open={uncoveredOpen}
              onToggle={() => setUncoveredOpen((v) => !v)}
            />
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            {uncoveredOpen && (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
                <UncoveredBlock uncovered={uncovered} />
              </div>
            )}
            {panelChildren}
          </div>
        </div>
      </div>
    );
  }

  if (layout === "accordions") {
    return (
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-none border border-border/60 bg-card/50 divide-y divide-border/60",
          className
        )}
      >
        {!bantInHeader && (
          <LiveCollapsibleSection flush title="BANT live" summary={bantSummary} defaultOpen>
            <div className="pt-2">
              <BantLiveTiles checklist={checklist} />
            </div>
          </LiveCollapsibleSection>
        )}

        <div className="px-3 py-2.5">
          <KeywordsRow keywords={keywordEntries} />
        </div>

        <SentimentSection
          transcript={transcript}
          sentimentAE={sentimentAE}
          sentimentCustomer={sentimentCustomer}
          sentimentShift={sentimentShift}
        />

        <LiveCollapsibleSection
          flush
          title="Still uncovered"
          summary={
            uncovered.length > 0
              ? uncovered.slice(0, 2).join(" · ")
              : "No open discovery gaps"
          }
          count={uncovered.length}
          variant={uncovered.length > 0 ? "attention" : "default"}
          defaultOpen={uncovered.length > 0}
        >
          <div className="pt-2">
            <UncoveredBlock uncovered={uncovered} />
          </div>
        </LiveCollapsibleSection>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <section>
        <LiveSubsectionHeader title="BANT live" />
        <BantLiveTiles checklist={checklist} />
      </section>

      <section>
        <KeywordsRow keywords={keywordEntries} />
      </section>

      <section>
        <SentimentSection
          transcript={transcript}
          sentimentAE={sentimentAE}
          sentimentCustomer={sentimentCustomer}
          sentimentShift={sentimentShift}
        />
      </section>

      <section>
        <LiveSubsectionHeader title="Still uncovered" />
        <UncoveredBlock uncovered={uncovered} />
      </section>
    </div>
  );
}
