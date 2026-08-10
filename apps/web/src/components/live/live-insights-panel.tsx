"use client";

import { LiveColumnHeader } from "@/components/live/live-column-header";
import {
  LiveCopilotChatComposer,
  LiveCopilotChatProvider,
  LiveCopilotChatThread,
  useLiveCopilotChat,
} from "@/components/live/live-copilot-chat";
import { LiveCopilotSummary } from "@/components/live/live-copilot-summary";
import { LiveMetricsRail } from "@/components/live/live-metrics-rail";
import { cn } from "@/lib/cn";
import type { BantSignal } from "@/lib/live-types";
import type { LiveInsightLine } from "@/lib/live/build-copilot-insights";
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
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import { Maximize2, Minimize2, Sparkles } from "lucide-react";
import { type RefObject, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  sentimentAE: number | null;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: number | null;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  bantSignals: BantSignal[];
  suggestionLog: SuggestionLogEntry[];
  openGaps: string[];
}

type LiveCopilotPanelContentProps = Pick<
  LiveInsightsPanelProps,
  | "accountName"
  | "leadName"
  | "intent"
  | "intentLabel"
  | "checklist"
  | "transcript"
  | "pains"
  | "insights"
> & {
  panelScrollRef: RefObject<HTMLDivElement | null>;
};

function insightHelpNoun(kind: LiveInsightLine["kind"]) {
  if (kind === "question") return "question";
  if (kind === "alert") return "risk alert";
  return "signal";
}

function LiveCopilotFocusButton({
  isFocused,
  onToggle,
}: {
  isFocused: boolean;
  onToggle: () => void;
}) {
  const Icon = isFocused ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 type-kicker font-semibold transition-colors",
        isFocused
          ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
          : "border-border/80 bg-background text-foreground hover:border-foreground"
      )}
      title={isFocused ? "Exit focus mode" : "Focus mode"}
      aria-label={isFocused ? "Exit focus mode" : "Open focus mode"}
      onClick={onToggle}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{isFocused ? "EXIT" : "FOCUS MODE"}</span>
    </button>
  );
}

function LiveCopilotPanelContent({
  accountName,
  leadName,
  intent,
  intentLabel,
  checklist,
  transcript,
  pains,
  insights,
  panelScrollRef,
}: LiveCopilotPanelContentProps) {
  const { sendMessage } = useLiveCopilotChat();

  const handleHelpWithInsight = useCallback(
    (insight: LiveInsightLine) => {
      const noun = insightHelpNoun(insight.kind);
      void sendMessage(`Help me with this ${noun}: ${insight.message}`, {
        requestedHelp: "live_insight_strategy",
        selectedInsight: {
          id: insight.id,
          label: insight.label,
          kind: insight.kind,
          message: insight.message,
          details: insight.details ?? [],
        },
      });
    },
    [sendMessage]
  );

  return (
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
        onHelpWithInsight={handleHelpWithInsight}
        className="min-w-0"
      />

      <div className="mt-4 border-t border-border/50 pt-4">
        <LiveCopilotChatThread scrollContainerRef={panelScrollRef} />
      </div>
    </>
  );
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
  const [focusMode, setFocusMode] = useState(false);
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

  useEffect(() => {
    if (!focusMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusMode]);

  return (
    <LiveCopilotChatProvider callId={callId} context={liveCopilotContext}>
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden",
          focusMode &&
            "fixed inset-0 z-50 h-screen max-h-screen w-screen bg-background text-foreground"
        )}
        role={focusMode ? "dialog" : undefined}
        aria-modal={focusMode ? true : undefined}
        aria-label={focusMode ? "Live copilot focus mode" : undefined}
      >
        <div
          className={cn(
            "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden",
            focusMode && "mx-auto max-w-6xl border-x border-border/60 bg-background shadow-2xl"
          )}
        >
          <LiveColumnHeader
            icon={Sparkles}
            title="Live copilot"
            extra={
              <LiveCopilotFocusButton
                isFocused={focusMode}
                onToggle={() => setFocusMode((value) => !value)}
              />
            }
            className={focusMode ? "h-14 px-5 md:px-8" : undefined}
          />
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
            className={focusMode ? "border-t-0" : undefined}
            panelChildren={
              <LiveCopilotPanelContent
                accountName={accountName}
                leadName={leadName}
                intent={intent}
                intentLabel={intentLabel}
                checklist={checklist}
                transcript={transcript}
                pains={pains}
                insights={insights}
                panelScrollRef={panelScrollRef}
              />
            }
          />

          <LiveCopilotChatComposer className={focusMode ? "bg-background" : undefined} />
        </div>
      </div>
    </LiveCopilotChatProvider>
  );
});

LiveInsightsPanel.displayName = "LiveInsightsPanel";
