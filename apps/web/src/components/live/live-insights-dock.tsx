"use client";

import { useMemo } from "react";
import { KeywordFrequencyPanel } from "@/components/live/keyword-frequency-panel";
import { LiveCollapsibleSection } from "@/components/live/live-collapsible-section";
import { ObjectionCard } from "@/components/live/objection-card";
import { SentimentDisplayPanel } from "@/components/live/sentiment-display-panel";
import { SignalLog } from "@/components/live/signal-log";
import { SuggestionLog } from "@/components/live/suggestion-log";
import { UnansweredQuestionsList } from "@/components/live/unanswered-questions-list";
import { filterKeywordStats } from "@/lib/live/keyword-filter";
import {
  resolveCustomerSentimentCue,
  resolveSalesRepToneCue,
  scoreEmoji,
  shiftEmoji,
} from "@/lib/live/sentiment-display";
import { formatBudgetSignalLabel } from "@/lib/currency-format";
import type { BantSignal } from "@/lib/live-types";
import type {
  KeywordStats,
  CustomerSentimentCue,
  ObjectionPayload,
  SalesRepToneCue,
  SentimentShift,
  SuggestionLogEntry,
  UnansweredQuestionPayload,
} from "@/types";

interface LiveInsightsDockProps {
  unansweredQuestions: UnansweredQuestionPayload[];
  objections: ObjectionPayload[];
  suggestionLog: SuggestionLogEntry[];
  bantSignals: BantSignal[];
  keywordStats: KeywordStats | null;
  sentimentAE: number;
  salesRepTone?: SalesRepToneCue | null;
  sentimentCustomer: number;
  customerSentiment?: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
}

function unansweredSummary(questions: UnansweredQuestionPayload[]): string | undefined {
  if (questions.length === 0) return undefined;
  const first = questions[questions.length - 1]?.text;
  if (questions.length === 1 && first) return first;
  return first ? `${questions.length} open — latest: ${first}` : `${questions.length} open questions`;
}

function objectionSummary(objections: ObjectionPayload[]): string | undefined {
  if (objections.length === 0) return undefined;
  const latest = objections[objections.length - 1];
  const label = latest.objection_text;
  if (objections.length === 1 && label) return label;
  return label ? `${objections.length} flagged — latest: ${label}` : `${objections.length} objections`;
}

function suggestionSummary(entries: SuggestionLogEntry[]): string | undefined {
  if (entries.length === 0) return undefined;
  const latest = entries[entries.length - 1];
  const op = latest.operation.replace(/_/g, " ");
  return latest.summary ? `${op} — ${latest.summary}` : op;
}

function bantSummary(signals: BantSignal[]): string | undefined {
  if (signals.length === 0) return undefined;
  const dims: Record<BantSignal["dimension"], string> = {
    budget: "💰 Budget",
    authority: "👤 Authority",
    need: "🎯 Need",
    timeline: "📅 Timeline",
  };
  const labels = signals.slice(-4).map((s) => {
    const label = s.dimension === "budget" ? formatBudgetSignalLabel(s.label, s.value) : s.label;
    return `${dims[s.dimension]} · ${label}`;
  });
  return labels.join(" · ");
}

function keywordSummary(stats: KeywordStats | null): string | undefined {
  const top = stats?.global_top?.slice(0, 3).map((k) => k.term) ?? [];
  if (top.length === 0) return "Industry & tech terms as they emerge";
  return top.join(", ");
}

export function LiveInsightsDock({
  unansweredQuestions,
  objections,
  suggestionLog,
  bantSignals,
  keywordStats,
  sentimentAE,
  salesRepTone,
  sentimentCustomer,
  customerSentiment,
  sentimentShift,
}: LiveInsightsDockProps) {
  const filteredKeywordStats = useMemo(
    () => filterKeywordStats(keywordStats),
    [keywordStats]
  );

  const hasKeywords =
    filteredKeywordStats != null &&
    (filteredKeywordStats.global_top.length > 0 ||
      Object.keys(filteredKeywordStats.by_speaker).length > 0);

  const hasSentiment =
    sentimentAE !== 0 || sentimentCustomer !== 0 || sentimentShift != null;
  const repToneCue = resolveSalesRepToneCue(sentimentAE, salesRepTone);
  const customerCue = resolveCustomerSentimentCue(sentimentCustomer, customerSentiment);

  const visibleSectionCount = useMemo(() => {
    let n = 0;
    if (unansweredQuestions.length > 0) n++;
    if (objections.length > 0) n++;
    if (suggestionLog.length > 0) n++;
    if (bantSignals.length > 0) n++;
    if (hasKeywords) n++;
    if (hasSentiment) n++;
    return n;
  }, [
    unansweredQuestions.length,
    objections.length,
    suggestionLog.length,
    bantSignals.length,
    hasKeywords,
    hasSentiment,
  ]);

  if (visibleSectionCount === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1">
        Live insights (BANT, keywords, objections) will appear here as the call progresses.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hasSentiment && (
        <LiveCollapsibleSection
          title="Sentiment"
          summary={`${scoreEmoji(sentimentAE)} ${repToneCue.label} · ${scoreEmoji(sentimentCustomer)} ${customerCue.label}${
            sentimentShift ? ` · ${shiftEmoji(sentimentShift.direction)} shift` : ""
          }`}
          defaultOpen
        >
          <SentimentDisplayPanel
            aeScore={sentimentAE}
            salesRepTone={salesRepTone}
            customerScore={sentimentCustomer}
            customerSentiment={customerSentiment}
            shift={sentimentShift}
            className="pt-2"
          />
        </LiveCollapsibleSection>
      )}

      {unansweredQuestions.length > 0 && (
        <LiveCollapsibleSection
          title="Unanswered prospect questions"
          count={unansweredQuestions.length}
          summary={unansweredSummary(unansweredQuestions)}
          defaultOpen
          variant="attention"
        >
          <UnansweredQuestionsList questions={unansweredQuestions} compact />
        </LiveCollapsibleSection>
      )}

      {objections.length > 0 && (
        <LiveCollapsibleSection
          title="Objections"
          count={objections.length}
          summary={objectionSummary(objections)}
          defaultOpen={objections.length <= 2}
        >
          <div className="space-y-2 pt-2">
            {objections.slice(-3).map((o) => (
              <ObjectionCard key={o.id} objection={o} />
            ))}
          </div>
        </LiveCollapsibleSection>
      )}

      {suggestionLog.length > 0 && (
        <LiveCollapsibleSection
          title="AI suggestion log"
          count={suggestionLog.length}
          summary={suggestionSummary(suggestionLog)}
        >
          <SuggestionLog entries={suggestionLog} compact />
        </LiveCollapsibleSection>
      )}

      {bantSignals.length > 0 && (
        <LiveCollapsibleSection
          title="BANT signals"
          count={bantSignals.length}
          summary={bantSummary(bantSignals)}
        >
          <SignalLog signals={bantSignals} />
        </LiveCollapsibleSection>
      )}

      {hasKeywords && (
        <LiveCollapsibleSection
          title="Keywords"
          summary={keywordSummary(filteredKeywordStats)}
        >
          <KeywordFrequencyPanel stats={filteredKeywordStats} />
        </LiveCollapsibleSection>
      )}
    </div>
  );
}
