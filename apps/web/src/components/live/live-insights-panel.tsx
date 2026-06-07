"use client";

import { memo, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import {
  LiveCopilotChatComposer,
  LiveCopilotChatProvider,
  LiveCopilotChatThread,
} from "@/components/live/live-copilot-chat";
import { LiveCopilotSummary } from "@/components/live/live-copilot-summary";
import { LiveColumnHeader } from "@/components/live/live-column-header";
import { LiveMetricsRail } from "@/components/live/live-metrics-rail";
import type { LiveInsightLine } from "@/lib/live/build-copilot-insights";
import type { BantSignal } from "@/lib/live-types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type {
  CallIntent,
  CustomerSentimentCue,
  KeywordStats,
  PainSignal,
  SalesRepToneCue,
  SentimentShift,
  SentimentSignal,
  SuggestionLogEntry,
  TranscriptEvent,
} from "@/types";

interface LiveInsightsPanelProps {
  callId: string;
  accountName: string;
  leadName?: string;
  intentLabel?: string;
  intent?: CallIntent | null;
  pains: PainSignal[];
  insights: LiveInsightLine[];
  checklist: DiscoveryChecklistState | null;
  keywordStats: KeywordStats | null;
  keywords: string[];
  transcript: TranscriptEvent[];
  sentimentAE: number;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: number;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  bantSignals: BantSignal[];
  suggestionLog: SuggestionLogEntry[];
  openGaps: string[];
}

export const LiveInsightsPanel = memo(function LiveInsightsPanel({
  callId,
  accountName,
  leadName,
  intentLabel,
  intent,
  pains,
  insights,
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
}: LiveInsightsPanelProps) {
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const liveCopilotContext = useMemo(
    () => ({
      accountName,
      leadName,
      intentLabel,
      intent,
      transcriptLineCount: transcript.length,
      transcriptTail: transcript.slice(-8).map((event) => ({
        speaker: event.speakerName,
        role: event.speakerRole,
        text: event.text,
        keywords: event.keywords,
        sentiment: event.sentiment,
      })),
      pains: pains.slice(0, 6).map((pain) => ({
        text: pain.text,
        source: pain.source,
        confidence: pain.confidence,
        evidence: pain.evidence,
      })),
      insights: insights.slice(0, 6).map((insight) => ({
        label: insight.label,
        kind: insight.kind,
        message: insight.message,
        details: insight.details,
      })),
      openGaps,
      checklistOpenGaps: checklist?.openGaps,
      keywords: keywords.slice(0, 12),
      bantSignals: bantSignals.slice(-8).map((signal) => ({
        dimension: signal.dimension,
        label: signal.label,
        value: signal.value,
        snippet: signal.snippet,
      })),
      suggestionLog: suggestionLog.slice(-8).map((entry) => ({
        operation: entry.operation,
        summary: entry.summary,
        confidence: entry.confidence,
      })),
      sentiment: {
        aeScore: sentimentAE,
        customerScore: sentimentCustomer,
        salesRepTone,
        customerSentiment,
        sentimentShift,
      },
    }),
    [
      accountName,
      leadName,
      intentLabel,
      intent,
      transcript,
      pains,
      insights,
      openGaps,
      checklist,
      keywords,
      bantSignals,
      suggestionLog,
      sentimentAE,
      sentimentCustomer,
      salesRepTone,
      customerSentiment,
      sentimentShift,
    ]
  );

  return (
    <LiveCopilotChatProvider callId={callId} context={liveCopilotContext}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <LiveColumnHeader icon={Sparkles} title="Live copilot" />
        <LiveMetricsRail
          layout="copilot-panel"
          checklist={checklist}
          keywordStats={keywordStats}
          keywords={keywords}
          transcript={transcript}
          sentimentAE={sentimentAE}
          salesRepTone={salesRepTone}
          sentimentCustomer={sentimentCustomer}
          customerSentiment={customerSentiment}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          bantSignals={bantSignals}
          suggestionLog={suggestionLog}
          openGaps={openGaps}
          panelScrollRef={panelScrollRef}
          panelChildren={
            <>
              <LiveCopilotSummary
                accountName={accountName}
                leadName={leadName}
                intent={intent}
                intentLabel={intentLabel}
                checklist={checklist}
                transcript={transcript}
                pains={pains}
                insights={insights}
                className="min-w-0"
              />

              <div className="border-t border-border/50 pt-4 mt-4">
                <LiveCopilotChatThread scrollContainerRef={panelScrollRef} />
              </div>
            </>
          }
        />

        <LiveCopilotChatComposer />
      </div>
    </LiveCopilotChatProvider>
  );
});

LiveInsightsPanel.displayName = "LiveInsightsPanel";
