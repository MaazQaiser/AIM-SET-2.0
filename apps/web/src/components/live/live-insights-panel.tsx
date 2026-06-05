"use client";

import { memo } from "react";
import { LiveCopilotHeader } from "@/components/live/live-copilot-header";
import {
  LiveAssistantCard,
  type AssistantCardKind,
} from "@/components/live/live-assistant-card";
import {
  LiveCopilotChatComposer,
  LiveCopilotChatProvider,
  LiveCopilotChatThread,
} from "@/components/live/live-copilot-chat";
import { LiveMetricsRail } from "@/components/live/live-metrics-rail";
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

export interface LiveInsightsFeedItem {
  id: string;
  kind: AssistantCardKind;
  message: string;
  contextLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

interface LiveInsightsPanelProps {
  callId: string;
  assistantFeed: LiveInsightsFeedItem[];
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
  assistantFeed,
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
  return (
    <LiveCopilotChatProvider callId={callId}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <LiveCopilotHeader checklist={checklist} />
        <LiveMetricsRail
          layout="copilot-panel"
          bantInHeader
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
          panelChildren={
            <>
              <div className="shrink-0 border-t border-border/50 pt-1">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  Live prompts
                </p>
              </div>

              <div className="space-y-2.5">
                {assistantFeed.length > 0 ? (
                  assistantFeed.map((item) => (
                    <LiveAssistantCard
                      key={item.id}
                      id={item.id}
                      kind={item.kind}
                      message={item.message}
                      contextLabel={item.contextLabel}
                      actionLabel={item.actionLabel}
                      onAction={item.onAction}
                      onDismiss={item.onDismiss}
                    />
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                    AI prompts and alerts will stack here as the call progresses.
                  </p>
                )}
              </div>

              <LiveCopilotChatThread />
            </>
          }
        />

        <LiveCopilotChatComposer />
      </div>
    </LiveCopilotChatProvider>
  );
});

LiveInsightsPanel.displayName = "LiveInsightsPanel";
