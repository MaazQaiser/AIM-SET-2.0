"use client";

import { useMemo } from "react";
import { Activity, Mic } from "lucide-react";
import { Card } from "@dc-copilot/ui/components/card";
import { BotChatPanel } from "@/components/bot-chat-panel";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { DemoTranscriptPlayer } from "@/components/live/demo-transcript-player";
import {
  LiveColumnHeader,
  liveColumnBodyClass,
} from "@/components/live/live-column-header";
import type { AssistantCardKind } from "@/components/live/live-assistant-card";
import { LiveInsightsPanel } from "@/components/live/live-insights-panel";
import { LiveKeywordsBar, LiveSentimentBar, LiveSignalLogs } from "@/components/live/live-metrics-rail";
import { LiveCallPageHeader } from "@/components/live/live-call-page-header";
import { LiveRunningSummaryBar } from "@/components/live/live-running-summary-bar";
import { PostDcReviewScreen } from "@/components/post-dc/post-dc-review-screen";
import { TranscriptViewer } from "@/components/transcript-viewer";
import type { CallBrief } from "@/lib/brief-types";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";
import type {
  Call,
  CustomerSentimentCue,
  IntentSnapshot,
  KeywordStats,
  NudgePayload,
  ObjectionPayload,
  SalesRepToneCue,
  SentimentSignal,
  SentimentShift,
  SuggestionLogEntry,
  TranscriptEvent,
  UnansweredQuestionPayload,
} from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { copyTextToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

interface AssistantFeedItem {
  id: string;
  kind: AssistantCardKind;
  message: string;
  contextLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

function buildAssistantFeed({
  customerSentiment,
  nudges,
  objections,
  unansweredQuestions,
  onAcceptNudge,
  onDismissNudge,
}: {
  customerSentiment: CustomerSentimentCue | null;
  nudges: NudgePayload[];
  objections: ObjectionPayload[];
  unansweredQuestions: UnansweredQuestionPayload[];
  onAcceptNudge: (id: string) => void;
  onDismissNudge: (id: string) => void;
}): AssistantFeedItem[] {
  const items: AssistantFeedItem[] = [];

  if (customerSentiment) {
    items.push({
      id: `customer-intent-${customerSentiment.label}`,
      kind: "insight",
      message: `Customer intent: ${customerSentiment.label}. ${customerSentiment.guidance}`,
      contextLabel: "Customer signal",
    });
  }

  for (const n of nudges) {
    const kind: AssistantCardKind =
      n.source === "discovery-checklist" ? "question" : "insight";
    items.push({
      id: n.id,
      kind,
      message: n.message,
      contextLabel: n.checklistItemId ? "BANT gap" : "Live signal",
      actionLabel: kind === "question" ? "Copy question" : "Got it",
      onAction: () => {
        if (kind === "question") {
          void copyTextToClipboard(n.message).then((copied) => {
            if (copied) toast.success("Copied to clipboard");
            else toast.error("Click back into the page before copying");
          });
        }
        onAcceptNudge(n.id);
      },
      onDismiss: () => onDismissNudge(n.id),
    });
  }

  for (const o of objections.slice(-3)) {
    items.push({
      id: `objection-${o.id ?? o.objection_text}`,
      kind: "alert",
      message: o.objection_text,
      contextLabel: "Objection detected",
      actionLabel: "Flag deal",
      onAction: () => toast.message("Deal flagged for follow-up"),
    });
  }

  for (const q of unansweredQuestions.slice(-3)) {
    items.push({
      id: `question-${q.id ?? q.text}`,
      kind: "question",
      message: q.text,
      contextLabel: "Unanswered",
      actionLabel: "Copy question",
      onAction: () => {
        void copyTextToClipboard(q.text).then((copied) => {
          if (copied) toast.success("Copied to clipboard");
          else toast.error("Click back into the page before copying");
        });
      },
    });
  }

  return items;
}

export interface LiveCallWorkspaceProps {
  callId: string;
  call?: Call | null;
  brief?: CallBrief | null;
  hasReview: boolean;
  accountName: string;
  leadName?: string;
  transcript: TranscriptEvent[];
  keywords: string[];
  visibleNudges: NudgePayload[];
  objections: ObjectionPayload[];
  unansweredQuestions: UnansweredQuestionPayload[];
  suggestionLog: SuggestionLogEntry[];
  bantSignals: BantSignal[];
  checklist: DiscoveryChecklistState | null;
  intentLabel?: string;
  intentSnapshot: IntentSnapshot | null;
  keywordStats: KeywordStats | null;
  sentimentAE: number;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: number;
  customerSentiment: CustomerSentimentCue | null;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  activePanel: string | null;
  onPanelChange: (panel: "transcript" | "signals" | "insights" | "chat" | "wrap-up") => void;
  onAcceptNudge: (id: string) => void;
  onDismissNudge: (id: string) => void;
}

export function LiveCallWorkspace({
  callId,
  call,
  brief,
  hasReview,
  accountName,
  leadName,
  transcript,
  keywords,
  visibleNudges,
  objections,
  unansweredQuestions,
  suggestionLog,
  bantSignals,
  checklist,
  intentLabel,
  intentSnapshot,
  keywordStats,
  sentimentAE,
  salesRepTone,
  sentimentCustomer,
  customerSentiment,
  sentimentShift,
  sentimentSignals,
  activePanel,
  onPanelChange,
  onAcceptNudge,
  onDismissNudge,
}: LiveCallWorkspaceProps) {
  const assistantFeed = useMemo(
    () =>
      buildAssistantFeed({
        customerSentiment,
        nudges: visibleNudges,
        objections,
        unansweredQuestions,
        onAcceptNudge,
        onDismissNudge,
      }),
    [customerSentiment, visibleNudges, objections, unansweredQuestions, onAcceptNudge, onDismissNudge]
  );

  const openGaps = checklist?.openGaps ?? [];

  const transcriptColumn = (
    <>
      <LiveColumnHeader icon={Mic} title="Live transcript" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {transcript.length > 0 ? (
          <TranscriptViewer
            events={transcript}
            keywords={keywords}
            isLive
            className="flex-1 min-h-0"
          />
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Waiting for transcript. Start Recall above or play a demo transcript.
          </p>
        )}
      </div>
    </>
  );

  const insightsPanel = (
    <LiveInsightsPanel
      callId={callId}
      assistantFeed={assistantFeed}
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
    />
  );

  const runningSummary = (
    <LiveRunningSummaryBar
      embedded
      accountName={accountName}
      leadName={leadName}
      intent={intentSnapshot?.intent ?? null}
      intentLabel={intentLabel}
      pains={intentSnapshot?.pains ?? []}
      checklist={checklist}
      transcript={transcript}
      className="min-w-0"
    />
  );

  const liveInsightsMetrics = (
    <>
      <LiveKeywordsBar
        keywordStats={keywordStats}
        keywords={keywords}
        transcript={transcript}
        className="border-0 bg-transparent backdrop-blur-none"
      />
      <LiveSentimentBar
        transcript={transcript}
        sentimentAE={sentimentAE}
        salesRepTone={salesRepTone}
        sentimentCustomer={sentimentCustomer}
        customerSentiment={customerSentiment}
        sentimentShift={sentimentShift}
        className="border-0 bg-transparent backdrop-blur-none"
      />
      <LiveSignalLogs
        sentimentSignals={sentimentSignals}
        bantSignals={bantSignals}
      />
    </>
  );

  const metricsColumn = (
    <Card className="flex h-full min-h-0 min-w-0 flex-[3] flex-col overflow-hidden">
      <LiveColumnHeader icon={Activity} title="Live signals" />
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-border/60 overflow-y-auto">
        {liveInsightsMetrics}
      </div>
    </Card>
  );

  const copilotColumn = (
    <Card className="flex h-full min-h-0 min-w-0 flex-[4] flex-col overflow-hidden">
      {insightsPanel}
    </Card>
  );

  const rightInsightsColumn = (
    <div className="flex h-full min-h-0 w-[640px] shrink-0 flex-col gap-4 overflow-hidden">
      {runningSummary}
      <div className="flex h-0 min-h-0 flex-1 gap-4 overflow-hidden">
        {metricsColumn}
        {copilotColumn}
      </div>
    </div>
  );

  return (
    <div className="live-call-page call-detail-page flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <LiveCallPageHeader
        callId={callId}
        call={call}
        accountName={accountName}
        leadName={leadName}
        hasReview={hasReview}
      />

      <div className="flex h-0 min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pt-4 sm:px-8">
        <div className="hidden h-0 min-h-0 flex-1 flex-col overflow-hidden xl:flex">
          <div className="flex h-0 min-h-0 flex-1 gap-4 overflow-hidden">
            <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {transcriptColumn}
            </Card>
            {rightInsightsColumn}
          </div>
        </div>

        <div className="flex h-0 min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:hidden">
          <Tabs
            value={activePanel ?? "transcript"}
            onValueChange={(v) =>
              onPanelChange(v as "transcript" | "signals" | "insights" | "chat" | "wrap-up")
            }
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <TabsList className="h-10 w-full shrink-0 justify-start overflow-x-auto rounded-none border-b border-border/60 bg-transparent px-0">
              <TabsTrigger value="transcript" className="text-xs">
                Transcript
              </TabsTrigger>
              <TabsTrigger value="signals" className="text-xs">
                Signals
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs">
                Live copilot
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                Pod chat
              </TabsTrigger>
              <TabsTrigger value="wrap-up" className="text-xs">
                Wrap-up
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="transcript"
              className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">{transcriptColumn}</Card>
            </TabsContent>
            <TabsContent
              value="signals"
              className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden divide-y divide-border/60">
                {liveInsightsMetrics}
              </Card>
            </TabsContent>
            <TabsContent
              value="insights"
              className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                {runningSummary}
                <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">{insightsPanel}</Card>
              </div>
            </TabsContent>
            <TabsContent
              value="chat"
              className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <BotChatPanel
                  callId={callId}
                  phase="live"
                  className="h-full min-h-0"
                  accountName={accountName}
                  brief={brief}
                  intentLabel={intentLabel}
                  painCount={intentSnapshot?.pains?.length ?? 0}
                  checklist={checklist}
                  transcriptLineCount={transcript.length}
                  hasObjections={objections.length > 0}
                />
              </Card>
            </TabsContent>
            <TabsContent
              value="wrap-up"
              className="m-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
            >
              <PostDcReviewScreen callId={callId} embedded />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
