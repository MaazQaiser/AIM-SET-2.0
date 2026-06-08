"use client";

import { useMemo, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { SignalLog } from "@/components/live/signal-log";
import { SuggestionLog } from "@/components/live/suggestion-log";
import { buildLiveKeywordEntries } from "@/lib/live/keyword-filter";
import {
  formatSentimentScore,
  hasSentimentScore,
  resolveCustomerSentimentCue,
  resolveSalesRepToneCue,
  scoreToTone,
  type SentimentScore,
} from "@/lib/live/sentiment-display";
import type { BantSignal } from "@/lib/live-types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type {
  CustomerSentimentCue,
  KeywordStats,
  SalesRepToneCue,
  SentimentShift,
  SentimentSignal,
  SuggestionLogEntry,
  TranscriptEvent,
} from "@/types";
import { LiveCollapsibleSection } from "@/components/live/live-collapsible-section";
import { LiveSentimentLineChart } from "@/components/live/live-sentiment-line-chart";
import { LiveSubsectionHeader, liveColumnContentPadding } from "@/components/live/live-column-header";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { participantKindFromRole } from "@/lib/attendees/participant-display";
import { cn } from "@/lib/cn";

const BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;

type BantKey = (typeof BANT_KEYS)[number];
type SentimentTone = "positive" | "neutral" | "negative";

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
  sentimentAE: SentimentScore;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: SentimentScore;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  bantSignals: BantSignal[];
  suggestionLog: SuggestionLogEntry[];
  openGaps: string[];
  /** stack | accordions | copilot-panel (sticky metrics + scrollable body) */
  layout?: "stack" | "accordions" | "copilot-panel";
  /** BANT is shown in BantLiveWidget above Live signals — omit duplicate accordion */
  bantInHeader?: boolean;
  /** Rendered in the scroll region when layout is copilot-panel */
  panelChildren?: React.ReactNode;
  /** Scroll container for the copilot panel body. */
  panelScrollRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

export function BantLiveTiles({ checklist }: { checklist: DiscoveryChecklistState | null }) {
  if (!checklist) {
    return (
      <p className="type-caption text-muted-foreground">
        BANT signals will appear as the conversation progresses.
      </p>
    );
  }

  const checklistItems = Array.isArray(checklist.items) ? checklist.items : [];
  const evidenceById = Object.fromEntries(
    checklistItems
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
            <p className="type-caption font-medium text-muted-foreground">
              {bantLabels[key]}
            </p>
            <p
              className={cn(
                "type-caption font-bold mt-0.5",
                variant === "good" && "text-success",
                variant === "warn" && "text-destructive",
                variant === "neutral" && "text-foreground"
              )}
            >
              {bantStatusLabel(status, key)}
            </p>
            {evidence?.text && (
              <p className="type-caption text-muted-foreground mt-1 line-clamp-2 leading-snug">
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

function scoreTextClass(score: SentimentScore, toneOverride?: SentimentTone): string {
  const tone = toneOverride ?? scoreToTone(score);
  if (tone === "positive") return "text-success";
  if (tone === "negative") return "text-destructive";
  if (!hasSentimentScore(score)) return "text-muted-foreground";
  return "text-warning";
}

function SentimentMetricRow({
  label,
  dataLabel,
  score,
  value,
  toneOverride,
}: {
  label: string;
  dataLabel?: string;
  score: SentimentScore;
  value?: string;
  toneOverride?: SentimentTone;
}) {
  const tone = toneOverride ?? scoreToTone(score) ?? "neutral";
  const normalizedDataLabel = dataLabel ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0"
      data-sentiment-label={normalizedDataLabel}
      data-sentiment-tone={tone}
    >
      <span className="shrink-0 type-caption text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right type-label", scoreTextClass(score, tone))}>
        {value ?? formatSentimentScore(score)}
      </span>
    </div>
  );
}

function sentimentDecisionCue(cue: CustomerSentimentCue): {
  id: "recover" | "advance" | "listen";
  label: string;
} {
  if (cue.tone === "negative") return { id: "recover", label: "Recover trust" };
  if (cue.tone === "positive") return { id: "advance", label: "Advance next step" };
  return { id: "listen", label: "Keep discovery open" };
}

function KeywordPills({ keywords }: { keywords: { term: string; count: number }[] }) {
  return (
    <>
      {keywords.map(({ term, count }) => (
        <span
          key={term}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/40 py-0.5 pl-2 pr-1.5 type-caption font-medium text-foreground"
        >
          <span className="whitespace-nowrap">{term}</span>
          <span
            className="min-w-[1.125rem] shrink-0 rounded-full bg-muted/70 px-1 text-center type-caption font-medium tabular-nums text-muted-foreground"
            aria-label={`${count} mentions`}
          >
            {count}
          </span>
        </span>
      ))}
    </>
  );
}

function keywordSummary(keywords: { term: string; count: number }[]): string {
  if (keywords.length === 0) return "Topics appear as the call progresses.";
  return keywords
    .slice(0, 4)
    .map(({ term, count }) => `${term} ${count}`)
    .join(" · ");
}

function KeywordsRow({
  keywords,
  layout = "inline",
}: {
  keywords: { term: string; count: number }[];
  layout?: "inline" | "stack" | "stack-content";
}) {
  const body =
    keywords.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <KeywordPills keywords={keywords} />
      </div>
    ) : (
      <p className="type-caption text-muted-foreground">Topics appear as the call progresses.</p>
    );

  if (layout === "stack-content") {
    return <div className="flex min-w-0 flex-col gap-2">{body}</div>;
  }

  if (layout === "stack") {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <span className="type-label text-foreground">Keywords</span>
        {body}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 type-label text-foreground">Keywords</span>
      {keywords.length > 0 ? (
        <div className="min-w-0 flex-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          <div className="flex w-max flex-nowrap items-center justify-start gap-1.5">
            <KeywordPills keywords={keywords} />
          </div>
        </div>
      ) : (
        <p className="min-w-0 type-caption text-muted-foreground">Topics appear as the call progresses.</p>
      )}
    </div>
  );
}

export function LiveKeywordsBar({
  keywordStats,
  keywords,
  transcript,
  className,
  embedded = false,
}: {
  keywordStats: KeywordStats | null;
  keywords: string[];
  transcript: TranscriptEvent[];
  className?: string;
  /** Render inside a card that already has a column header */
  embedded?: boolean;
}) {
  const keywordEntries = useMemo(
    () => buildLiveKeywordEntries(keywordStats, keywords, transcript),
    [keywordStats, keywords, transcript]
  );

  if (embedded) {
    return (
      <div className={cn("min-w-0", className)} data-testid="keywords-section">
        <KeywordsRow keywords={keywordEntries} layout="stack-content" />
      </div>
    );
  }

  return (
    <div className={cn("shrink-0", className)}>
      <LiveCollapsibleSection
        flush
        title="Keywords"
        count={keywordEntries.length > 0 ? keywordEntries.length : undefined}
        summary={keywordSummary(keywordEntries)}
        defaultOpen
      >
        <KeywordsRow keywords={keywordEntries} layout="stack-content" />
      </LiveCollapsibleSection>
    </div>
  );
}

function SentimentSection({
  transcript,
  sentimentAE,
  salesRepTone,
  sentimentCustomer,
  customerSentiment,
  sentimentShift,
  sentimentSignals,
  className,
  layout = "inline",
  hideCustomerMetric = false,
  signalLimit = 8,
}: {
  transcript: TranscriptEvent[];
  sentimentAE: SentimentScore;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: SentimentScore;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  className?: string;
  layout?: "inline" | "stack" | "stack-content";
  hideCustomerMetric?: boolean;
  signalLimit?: number;
}) {
  const repToneCue = resolveSalesRepToneCue(sentimentAE, salesRepTone);
  const customerCue = resolveCustomerSentimentCue(sentimentCustomer, customerSentiment);

  const shiftMessage = sentimentShift ? (
    <p className="border-b border-border/50 py-2.5 type-caption leading-snug text-muted-foreground last:border-b-0">
      Shift:{" "}
      <span className={scoreTextClass(sentimentShift.to_score)}>
        {sentimentShift.message ||
          (sentimentShift.direction === "negative"
            ? "Customer concern rising"
            : "Customer confidence improving")}
      </span>
    </p>
  ) : null;
  const hasCustomerSignal = hasSentimentScore(sentimentCustomer) || Boolean(customerSentiment?.label?.trim());
  const decision = hasCustomerSignal ? sentimentDecisionCue(customerCue) : null;
  const decisionCue = decision ? (
    <p
      className="border-b border-border/50 py-2.5 type-caption leading-snug text-muted-foreground last:border-b-0"
      data-testid="sentiment-decision-cue"
      data-sentiment-decision={decision.id}
    >
      Recommended move:{" "}
      <span className={scoreTextClass(sentimentCustomer, customerCue.tone)}>
        {decision.label}
      </span>
    </p>
  ) : null;

  const metricsBlock = (
    <>
      {!hideCustomerMetric && (
        <SentimentMetricRow
          label="Customer"
          dataLabel="customer"
          score={sentimentCustomer}
          value={customerCue.label}
          toneOverride={customerCue.tone}
        />
      )}
      <SentimentMetricRow
        label="Sales rep tone"
        dataLabel="sales-rep"
        score={sentimentAE}
        value={repToneCue.label}
        toneOverride={repToneCue.tone}
      />
      <div className="border-b border-border/50 py-2.5 last:border-b-0">
        <p className="mb-1 type-kicker text-muted-foreground">
          Sentiment trend
        </p>
        <LiveSentimentLineChart
          compact
          transcript={transcript}
          customerScore={sentimentCustomer}
          sentimentSignals={sentimentSignals}
        />
      </div>
      {decisionCue}
      {shiftMessage}
    </>
  );

  const signalsBlock =
    sentimentSignals.length > 0 ? (
      <div className="mt-1" data-testid="sentiment-signals-section">
        {[...sentimentSignals].reverse().slice(0, signalLimit).map((signal) => (
          <SentimentSignalRow key={signal.id} signal={signal} />
        ))}
      </div>
    ) : (
      <p className="border-t border-border/50 py-2.5 type-caption text-muted-foreground">
        Sentiment signals will appear as the conversation progresses.
      </p>
    );

  const stackBody = (
    <>
      {metricsBlock}
      {signalsBlock}
    </>
  );

  if (layout === "stack-content") {
    return <div className={cn("flex min-w-0 flex-col", className)}>{stackBody}</div>;
  }

  if (layout === "stack") {
    return (
      <div className={cn("px-3 py-2.5", className)}>
        <div className="flex min-w-0 flex-col">
          <span className="mb-2 type-label text-foreground">Sentiment</span>
          {stackBody}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("px-3 py-2.5", className)}>
      <div className="flex min-w-0 flex-col">
        <span className="mb-2 shrink-0 type-label text-foreground">Sentiment</span>
        {stackBody}
      </div>
    </div>
  );
}

export function LiveSentimentBar({
  transcript,
  sentimentAE,
  salesRepTone,
  sentimentCustomer,
  customerSentiment,
  sentimentShift,
  sentimentSignals,
  className,
  embedded = false,
  hideCustomerMetric = false,
  signalLimit,
}: {
  transcript: TranscriptEvent[];
  sentimentAE: SentimentScore;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: SentimentScore;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  className?: string;
  embedded?: boolean;
  hideCustomerMetric?: boolean;
  signalLimit?: number;
}) {
  const repToneCue = resolveSalesRepToneCue(sentimentAE, salesRepTone);
  const customerCue = resolveCustomerSentimentCue(sentimentCustomer, customerSentiment);
  const latestSignal = sentimentSignals.length > 0 ? sentimentSignals[sentimentSignals.length - 1] : null;

  if (embedded) {
    return (
      <div className={cn("min-w-0", className)} data-testid="sentiment-section">
        <SentimentSection
          layout="stack-content"
          transcript={transcript}
          sentimentAE={sentimentAE}
          salesRepTone={salesRepTone}
          sentimentCustomer={sentimentCustomer}
          customerSentiment={customerSentiment}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          hideCustomerMetric={hideCustomerMetric}
          signalLimit={signalLimit}
        />
      </div>
    );
  }

  return (
    <div className={cn("shrink-0", className)} data-testid="sentiment-section">
      <LiveCollapsibleSection
        flush
        title="Sentiment"
        summary={
          latestSignal
            ? `Customer ${customerCue.label} · ${latestSignal.label}`
            : `Customer ${customerCue.label} · Sales rep ${repToneCue.label}`
        }
        defaultOpen
      >
        <SentimentSection
          layout="stack-content"
          transcript={transcript}
          sentimentAE={sentimentAE}
          salesRepTone={salesRepTone}
          sentimentCustomer={sentimentCustomer}
          customerSentiment={customerSentiment}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          hideCustomerMetric={hideCustomerMetric}
          signalLimit={signalLimit}
        />
      </LiveCollapsibleSection>
    </div>
  );
}

function SentimentSignalRow({ signal }: { signal: SentimentSignal }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(signal.snippet?.trim());

  return (
    <div className="border-b border-border/50 last:border-b-0" data-sentiment-tone={signal.tone}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 py-2.5 text-left"
        aria-expanded={open}
        disabled={!hasDetail}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        <div className="flex min-w-0 items-start gap-2">
          <ParticipantAvatar
            name={signal.speakerName ?? signal.speakerRole ?? "Speaker"}
            kind={participantKindFromRole(signal.speakerRole)}
            role={
              signal.speakerRole === "customer" || !signal.speakerRole
                ? "customer"
                : signal.speakerRole
            }
            size="xs"
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="type-label text-foreground">{signal.label}</p>
            <p className="mt-0.5 type-caption capitalize text-muted-foreground">
              {signal.speakerName ?? signal.speakerRole}
            </p>
          </div>
        </div>
        {hasDetail && (
          <ChevronDown
            className={cn(
              "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
        )}
      </button>
      {open && signal.snippet && (
        <p className="pb-2.5 pl-8 type-label leading-relaxed text-muted-foreground">{signal.snippet}</p>
      )}
    </div>
  );
}

function bantSignalsSummary(signals: BantSignal[]): string {
  if (signals.length === 0) return "BANT signals will appear as the conversation progresses.";
  const dims: Record<BantSignal["dimension"], string> = {
    budget: "Budget",
    authority: "Authority",
    need: "Need",
    timeline: "Timeline",
  };
  const latest = signals[signals.length - 1];
  return `${dims[latest.dimension]} · ${latest.label}`;
}

export function LiveSignalLogs({ bantSignals }: { bantSignals: BantSignal[] }) {
  if (bantSignals.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0">
      <LiveCollapsibleSection
        flush
        title="BANT signals"
        count={bantSignals.length}
        summary={bantSignalsSummary(bantSignals)}
        defaultOpen
      >
        <SignalLog signals={bantSignals} />
      </LiveCollapsibleSection>
    </div>
  );
}

function UncoveredBlock({ uncovered }: { uncovered: string[] }) {
  if (uncovered.length > 0) {
    return (
      <ul className="space-y-1.5 type-label text-foreground">
        {uncovered.map((item) => (
          <li key={item} className="flex gap-2 leading-snug">
            <span className="text-muted-foreground shrink-0">•</span>
            <span className="capitalize">{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="type-caption text-muted-foreground">Discovery gaps will list here.</p>;
}

export function LiveMetricsRail({
  checklist,
  keywordStats,
  keywords,
  transcript,
  sentimentAE,
  salesRepTone,
  sentimentCustomer,
  customerSentiment,
  sentimentShift,
  sentimentSignals,
  bantSignals,
  suggestionLog,
  openGaps,
  layout = "stack",
  bantInHeader = false,
  panelChildren,
  panelScrollRef,
  className,
}: LiveMetricsRailProps) {
  const keywordEntries = useMemo(
    () => buildLiveKeywordEntries(keywordStats, keywords, transcript),
    [keywordStats, keywords, transcript]
  );

  const uncovered = useMemo(() => {
    const checklistItems = Array.isArray(checklist?.items) ? checklist.items : [];
    const gapLabels = openGaps.map((g) => {
      const item = checklistItems.find((i) => i.id === g);
      return item?.suggestedQuestion ?? g.replace(/_/g, " ");
    });
    return gapLabels.slice(0, 6);
  }, [openGaps, checklist]);

  const bantSummary = bantLiveSummary(checklist);

  if (layout === "copilot-panel") {
    return (
      <div
        className={cn(
          "flex min-h-0 h-0 flex-1 flex-col overflow-hidden border-y border-border/60 bg-transparent",
          className
        )}
      >
        <div
          ref={panelScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]"
        >
          <div className={cn("flex flex-col gap-4", liveColumnContentPadding)}>{panelChildren}</div>
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
          salesRepTone={salesRepTone}
          sentimentCustomer={sentimentCustomer}
          customerSentiment={customerSentiment}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          layout="stack"
        />

        {bantSignals.length > 0 && (
          <LiveCollapsibleSection
            flush
            title="BANT signals"
            summary={`${bantSignals.length} captured signals`}
            count={bantSignals.length}
          >
            <div className="pt-2">
              <SignalLog signals={bantSignals} />
            </div>
          </LiveCollapsibleSection>
        )}

        {suggestionLog.length > 0 && (
          <LiveCollapsibleSection
            flush
            title="AI suggestion log"
            summary={`${suggestionLog.length} suggestions shown`}
            count={suggestionLog.length}
          >
            <div className="pt-2">
              <SuggestionLog entries={suggestionLog} compact />
            </div>
          </LiveCollapsibleSection>
        )}

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

      <section data-testid="sentiment-section">
        <SentimentSection
          transcript={transcript}
          sentimentAE={sentimentAE}
          salesRepTone={salesRepTone}
          sentimentCustomer={sentimentCustomer}
          customerSentiment={customerSentiment}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          layout="stack"
        />
      </section>

      <section>
        <LiveSubsectionHeader title="BANT signals" />
        <SignalLog signals={bantSignals} />
      </section>

      <section>
        <SuggestionLog entries={suggestionLog} />
      </section>

      <section>
        <LiveSubsectionHeader title="Still uncovered" />
        <UncoveredBlock uncovered={uncovered} />
      </section>
    </div>
  );
}
