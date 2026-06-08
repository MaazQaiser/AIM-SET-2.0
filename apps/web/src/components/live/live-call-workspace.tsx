"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, ChevronRight, Hash, Mic, PanelLeftClose } from "lucide-react";
import { Card } from "@dc-copilot/ui/components/card";
import { Button } from "@dc-copilot/ui/components/button";
import { BotChatPanel } from "@/components/bot-chat-panel";
import {
  LiveColumnHeader,
  liveColumnHorizontalPadding,
  liveColumnScrollPadding,
} from "@/components/live/live-column-header";
import { LiveInsightsPanel } from "@/components/live/live-insights-panel";
import { buildCopilotInsights } from "@/lib/live/build-copilot-insights";
import { BantLiveWidget } from "@/components/live/bant-live-widget";
import { LiveKeywordsBar, LiveSentimentBar } from "@/components/live/live-metrics-rail";
import { DemoTranscriptPlayer } from "@/components/live/demo-transcript-player";
import { LiveCallPageHeader } from "@/components/live/live-call-page-header";
import { LiveRelevantContentWidget } from "@/components/live/live-relevant-content-widget";
import { LiveWidgetAccordionCard } from "@/components/live/live-widget-accordion-card";
import { PostDcReviewScreen } from "@/components/post-dc/post-dc-review-screen";
import { TranscriptViewer } from "@/components/transcript-viewer";
import type { CallBrief } from "@/lib/brief-types";
import { resolveCustomerSentimentCue } from "@/lib/live/sentiment-display";
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
import { cn } from "@/lib/cn";

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
  sentimentAE: number | null;
  salesRepTone: SalesRepToneCue | null;
  sentimentCustomer: number | null;
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
  const [viewportMode, setViewportMode] = useState<"desktop" | "mobile">("desktop");
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const copilotInsights = useMemo(
    () =>
      buildCopilotInsights({
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
  const customerCue = resolveCustomerSentimentCue(sentimentCustomer, customerSentiment);
  const customerTone = customerCue.tone;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setViewportMode(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const transcriptColumn = (
    <>
      <LiveColumnHeader
        icon={Mic}
        title="Live transcript"
        extra={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 type-caption text-muted-foreground"
            aria-label="Hide transcript"
            onClick={() => setTranscriptOpen(false)}
          >
            <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
            Hide
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {transcript.length > 0 ? (
          <TranscriptViewer
            events={transcript}
            keywords={keywords}
            isLive
            className="flex-1 min-h-0"
          />
        ) : (
          <div className={cn(liveColumnHorizontalPadding, "flex flex-col items-center justify-center gap-4 py-12 text-center")}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mic className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="type-body font-medium text-foreground">No live data yet</p>
              <p className="type-body-sm text-muted-foreground">
                Connect Recall to capture a live call, or run the demo to see the AI copilot in action.
              </p>
            </div>
            <DemoTranscriptPlayer callId={callId} />
          </div>
        )}
      </div>
    </>
  );

  const insightsPanel = (
    <LiveInsightsPanel
      callId={callId}
      accountName={accountName}
      leadName={leadName}
      intentLabel={intentLabel}
      intent={intentSnapshot?.intent ?? null}
      pains={intentSnapshot?.pains ?? []}
      insights={copilotInsights}
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

  const bantWidget = (
    <BantLiveWidget
      checklist={checklist}
      bantSignals={bantSignals}
      className="min-w-0"
    />
  );

  const keywordsCard = (
    <LiveWidgetAccordionCard
      icon={Hash}
      title="Keywords"
      defaultOpen={false}
      bodyClassName={cn(
        "max-h-[min(22vh,180px)] overflow-y-auto [scrollbar-width:thin]",
        liveColumnScrollPadding
      )}
    >
        <LiveKeywordsBar
          embedded
          keywordStats={keywordStats}
          keywords={keywords}
          transcript={transcript}
        />
    </LiveWidgetAccordionCard>
  );

  const signalsCard = (
    <LiveWidgetAccordionCard
      icon={Activity}
      title="Signals"
      extra={
        <span
          className={cn(
            "max-w-[12rem] truncate rounded-full px-2 py-0.5 type-caption font-medium",
            customerTone === "positive" && "bg-success/10 text-success",
            customerTone === "negative" && "bg-destructive/10 text-destructive",
            customerTone === "neutral" && "bg-muted text-muted-foreground"
          )}
        >
          Customer · {customerCue.label}
        </span>
      }
      bodyClassName={cn(
        "max-h-[min(27vh,245px)] overflow-y-auto [scrollbar-width:thin]",
        liveColumnScrollPadding
      )}
    >
        <LiveSentimentBar
          embedded
          transcript={transcript}
          sentimentAE={sentimentAE}
          salesRepTone={salesRepTone}
          sentimentCustomer={sentimentCustomer}
          customerSentiment={customerSentiment}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          hideCustomerMetric
          signalLimit={4}
        />
    </LiveWidgetAccordionCard>
  );

  const relevantContentCard = (
    <LiveWidgetAccordionCard
      icon={BookOpen}
      title="Relevant Content"
      summary="Projects and presentations"
      bodyClassName="min-h-0"
    >
      <LiveRelevantContentWidget
        callId={callId}
        call={call}
        brief={brief}
        accountName={accountName}
        leadName={leadName}
        keywords={keywords}
        transcript={transcript}
      />
    </LiveWidgetAccordionCard>
  );

  const signalsColumnInner = (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
      {bantWidget}
      {signalsCard}
      {relevantContentCard}
      {keywordsCard}
    </div>
  );

  const desktopColumns = (
    <div
      className={cn(
        "grid h-full min-h-0 flex-1 gap-4 overflow-hidden",
        transcriptOpen
          ? "grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(320px,1.75fr)]"
          : "grid-cols-[2.5rem_minmax(240px,1fr)_minmax(320px,1.85fr)]"
      )}
    >
      {transcriptOpen ? (
        <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{transcriptColumn}</Card>
      ) : (
        <button
          type="button"
          className="flex h-full w-10 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted/40"
          aria-label="Show transcript"
          onClick={() => setTranscriptOpen(true)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          <span className="type-caption font-medium [writing-mode:vertical-rl] rotate-180">
            Transcript
          </span>
        </button>
      )}
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">{signalsColumnInner}</div>
      <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{insightsPanel}</Card>
    </div>
  );

  const shouldRenderDesktop = viewportMode === "desktop";
  const shouldRenderMobile = viewportMode === "mobile";
  const activeMobilePanel = (activePanel ?? "transcript") as
    | "transcript"
    | "signals"
    | "insights"
    | "chat"
    | "wrap-up";

  return (
    <div className="live-call-page call-detail-page flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden">
      <LiveCallPageHeader
        callId={callId}
        call={call}
        accountName={accountName}
        leadName={leadName}
        hasReview={hasReview}
      />

      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden px-6 py-3 sm:px-8">
        {shouldRenderDesktop && (
          <div className="hidden h-full min-h-0 flex-1 overflow-hidden xl:block">
            {desktopColumns}
          </div>
        )}

        {shouldRenderMobile && (
          <div className="flex h-0 min-h-0 flex-1 flex-col gap-4 overflow-hidden xl:hidden">
            <Tabs
              value={activeMobilePanel}
              onValueChange={(v) =>
                onPanelChange(v as "transcript" | "signals" | "insights" | "chat" | "wrap-up")
              }
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList className="h-10 w-full shrink-0 justify-start overflow-x-auto rounded-none border-b border-border/60 bg-transparent px-0">
                <TabsTrigger value="transcript" className="type-label">
                  Transcript
                </TabsTrigger>
                <TabsTrigger value="signals" className="type-label">
                  Signals
                </TabsTrigger>
                <TabsTrigger value="insights" className="type-label">
                  Live copilot
                </TabsTrigger>
                <TabsTrigger value="chat" className="type-label">
                  Pod chat
                </TabsTrigger>
                <TabsTrigger value="wrap-up" className="type-label">
                  Wrap-up
                </TabsTrigger>
              </TabsList>

              {activeMobilePanel === "transcript" && (
                <TabsContent
                  value="transcript"
                  className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
                >
                  <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">{transcriptColumn}</Card>
                </TabsContent>
              )}
              {activeMobilePanel === "signals" && (
                <TabsContent
                  value="signals"
                  className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
                >
                  {signalsColumnInner}
                </TabsContent>
              )}
              {activeMobilePanel === "insights" && (
                <TabsContent
                  value="insights"
                  className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
                >
                  <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">{insightsPanel}</Card>
                </TabsContent>
              )}
              {activeMobilePanel === "chat" && (
                <TabsContent
                  value="chat"
                  className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
                >
                  <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <BotChatPanel
                      callId={callId}
                      phase="live"
                      surface="live_dc"
                      className="h-full min-h-0"
                      context={{
                        transcriptTail: transcript.slice(-8).map((event) => ({
                          speaker: event.speakerName,
                          role: event.speakerRole,
                          text: event.text,
                          keywords: event.keywords,
                          sentiment: event.sentiment,
                        })),
                      }}
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
              )}
              {activeMobilePanel === "wrap-up" && (
                <TabsContent
                  value="wrap-up"
                  className="m-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
                >
                  <PostDcReviewScreen callId={callId} embedded />
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
