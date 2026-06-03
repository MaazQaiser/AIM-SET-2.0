"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Sparkles, Users } from "lucide-react";
import { BotChatPanel } from "@/components/bot-chat-panel";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { DemoTranscriptPlayer } from "@/components/live/demo-transcript-player";
import {
  LiveColumnHeader,
  liveColumnBodyClass,
} from "@/components/live/live-column-header";
import {
  LiveAssistantCard,
  type AssistantCardKind,
} from "@/components/live/live-assistant-card";
import { LiveMetricsRail } from "@/components/live/live-metrics-rail";
import { LiveRunningSummaryBar } from "@/components/live/live-running-summary-bar";
import { RecallBotLauncher } from "@/components/live/recall-bot-launcher";
import { PostDcReviewScreen } from "@/components/post-dc/post-dc-review-screen";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { scoreToTone } from "@/lib/live/sentiment-display";
import type { CallBrief } from "@/lib/brief-types";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";
import type {
  Call,
  IntentSnapshot,
  KeywordStats,
  NudgePayload,
  ObjectionPayload,
  PodRole,
  SentimentSignal,
  SentimentShift,
  SuggestionLogEntry,
  TranscriptEvent,
  UnansweredQuestionPayload,
} from "@/types";
import { Button } from "@dc-copilot/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface AssistantFeedItem {
  id: string;
  kind: AssistantCardKind;
  message: string;
  contextLabel?: string;
  actionLabel?: string;
  role?: PodRole;
  onAction?: () => void;
  onDismiss?: () => void;
}

function buildAssistantFeed({
  nudges,
  objections,
  unansweredQuestions,
  onAcceptNudge,
  onDismissNudge,
}: {
  nudges: NudgePayload[];
  objections: ObjectionPayload[];
  unansweredQuestions: UnansweredQuestionPayload[];
  onAcceptNudge: (id: string) => void;
  onDismissNudge: (id: string) => void;
}): AssistantFeedItem[] {
  const items: AssistantFeedItem[] = [];

  for (const n of nudges) {
    const kind: AssistantCardKind =
      n.source === "discovery-checklist" ? "question" : "insight";
    items.push({
      id: n.id,
      kind,
      message: n.message,
      contextLabel: n.checklistItemId ? "BANT gap" : "Live signal",
      actionLabel: kind === "question" ? "Copy question" : "Got it",
      role: n.role,
      onAction: () => {
        if (kind === "question") {
          void navigator.clipboard.writeText(n.message);
          toast.success("Copied to clipboard");
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
        void navigator.clipboard.writeText(q.text);
        toast.success("Copied to clipboard");
      },
    });
  }

  return items;
}

function PodAvatars({ pod }: { pod: Call["pod"] }) {
  if (!pod?.length) return null;
  return (
    <div className="flex -space-x-1.5">
      {pod.slice(0, 3).map((member) => (
        <span
          key={member.id}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-semibold text-primary"
          title={member.name}
        >
          {member.initials}
        </span>
      ))}
    </div>
  );
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
  sentimentCustomer: number;
  sentimentShift: SentimentShift | null;
  sentimentSignals: SentimentSignal[];
  elapsedSeconds: number;
  isConnected: boolean;
  viewerRole: PodRole | null;
  activePanel: string | null;
  onPanelChange: (panel: "transcript" | "assistant" | "metrics" | "chat" | "wrap-up") => void;
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
  sentimentCustomer,
  sentimentShift,
  sentimentSignals,
  elapsedSeconds,
  isConnected,
  viewerRole,
  activePanel,
  onPanelChange,
  onAcceptNudge,
  onDismissNudge,
}: LiveCallWorkspaceProps) {
  const [assistantScope, setAssistantScope] = useState<"individual" | "group">("group");

  const sentimentTone = scoreToTone(sentimentCustomer);
  const sentimentLabel =
    sentimentTone === "positive"
      ? "Positive"
      : sentimentTone === "negative"
        ? "Cooling"
        : "Neutral";

  const assistantFeed = useMemo(() => {
    const feed = buildAssistantFeed({
      nudges: visibleNudges,
      objections,
      unansweredQuestions,
      onAcceptNudge,
      onDismissNudge,
    });
    if (assistantScope === "individual" && viewerRole) {
      return feed.filter((item) => !item.role || item.role === viewerRole);
    }
    return feed;
  }, [
    visibleNudges,
    objections,
    unansweredQuestions,
    onAcceptNudge,
    onDismissNudge,
    assistantScope,
    viewerRole,
  ]);

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
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Waiting for transcript. Start Recall above or play a demo transcript.
          </p>
        )}
      </div>
    </>
  );

  const assistantColumn = (
    <>
      <LiveColumnHeader
        icon={Sparkles}
        title="AI assistant"
        extra={
          <div className="flex items-center rounded-md border border-border p-0.5 text-[10px] shrink-0">
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                assistantScope === "individual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setAssistantScope("individual")}
            >
              Individual
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                assistantScope === "group"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setAssistantScope("group")}
            >
              Group
            </button>
          </div>
        }
      />
      <div className={cn(liveColumnBodyClass, "space-y-2.5")}>
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
          <p className="text-sm text-muted-foreground text-center py-8 px-2">
            AI prompts and alerts will stack here as the call progresses.
          </p>
        )}
      </div>
    </>
  );

  const metricsColumn = (
    <>
      <LiveColumnHeader icon={Users} title="Metrics & analysis" />
      <div className={liveColumnBodyClass}>
        <LiveMetricsRail
          checklist={checklist}
          keywordStats={keywordStats}
          keywords={keywords}
          transcript={transcript}
          sentimentAE={sentimentAE}
          sentimentCustomer={sentimentCustomer}
          sentimentShift={sentimentShift}
          sentimentSignals={sentimentSignals}
          openGaps={openGaps}
          bantSignals={bantSignals}
          suggestionLog={suggestionLog}
        />
      </div>
    </>
  );

  return (
    <div className="-m-4 flex min-h-[calc(100%+2rem)] flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-6 py-2 shrink-0">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground">
          <Link href={`/calls/${callId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{accountName}</p>
          {leadName && (
            <p className="text-xs text-muted-foreground truncate">{leadName}</p>
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-destructive shrink-0">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" aria-hidden />
          REC {formatElapsed(elapsedSeconds)}
        </span>

        <PodAvatars pod={call?.pod ?? []} />

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
            sentimentTone === "positive" && "bg-success/10 text-success",
            sentimentTone === "negative" && "bg-destructive/10 text-destructive",
            sentimentTone === "neutral" && "bg-muted text-muted-foreground"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {sentimentLabel}
        </span>

        {!isConnected && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            Connecting…
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <RecallBotLauncher callId={callId} meetingUrl={call?.meetingUrl} />
          <DemoTranscriptPlayer callId={callId} isConnected={isConnected} />
          <CallWrapUpActions
            callId={callId}
            accountName={accountName}
            hasReview={hasReview}
            showLiveLink={false}
            variant="compact"
          />
        </div>
      </header>

      <div className="hidden xl:flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex min-h-0 flex-1 divide-x divide-border">
          <section className="flex min-h-0 min-w-0 flex-[0.55] flex-col bg-card">
            {transcriptColumn}
          </section>
          <section className="flex min-h-0 min-w-0 flex-[0.95] flex-col bg-card">
            {assistantColumn}
          </section>
          <section className="flex min-h-0 min-w-0 flex-[0.75] flex-col bg-card">
            {metricsColumn}
          </section>
        </div>

        <LiveRunningSummaryBar
          accountName={accountName}
          leadName={leadName}
          intent={intentSnapshot?.intent ?? null}
          intentLabel={intentLabel}
          pains={intentSnapshot?.pains ?? []}
          checklist={checklist}
          transcript={transcript}
        />
      </div>

      <div className="xl:hidden flex flex-1 flex-col min-h-0 overflow-hidden">
        <Tabs
          value={activePanel ?? "transcript"}
          onValueChange={(v) =>
            onPanelChange(v as "transcript" | "assistant" | "metrics" | "chat" | "wrap-up")
          }
          className="flex flex-col h-full flex-1 min-h-0"
        >
          <TabsList className="rounded-none border-b border-border w-full justify-start px-2 h-10 bg-card shrink-0 overflow-x-auto">
            <TabsTrigger value="transcript" className="text-xs">
              Transcript
            </TabsTrigger>
            <TabsTrigger value="assistant" className="text-xs">
              Assistant
            </TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs">
              Metrics
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">
              Pod chat
            </TabsTrigger>
            <TabsTrigger value="wrap-up" className="text-xs">
              Wrap-up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcript" className="flex-1 overflow-hidden m-0 flex flex-col bg-card">
            {transcriptColumn}
          </TabsContent>
          <TabsContent value="assistant" className="flex-1 overflow-hidden m-0 flex flex-col bg-card">
            {assistantColumn}
          </TabsContent>
          <TabsContent value="metrics" className="flex-1 overflow-hidden m-0 flex flex-col bg-card">
            {metricsColumn}
          </TabsContent>
          <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
            <BotChatPanel
              callId={callId}
              phase="live"
              className="h-full"
              accountName={accountName}
              brief={brief}
              intentLabel={intentLabel}
              painCount={intentSnapshot?.pains?.length ?? 0}
              checklist={checklist}
              transcriptLineCount={transcript.length}
              hasObjections={objections.length > 0}
            />
          </TabsContent>
          <TabsContent value="wrap-up" className="flex-1 overflow-y-auto m-0 p-0">
            <PostDcReviewScreen callId={callId} embedded />
          </TabsContent>
        </Tabs>

        {(activePanel ?? "transcript") !== "wrap-up" &&
          (activePanel ?? "transcript") !== "chat" && (
            <LiveRunningSummaryBar
              accountName={accountName}
              leadName={leadName}
              intent={intentSnapshot?.intent ?? null}
              intentLabel={intentLabel}
              pains={intentSnapshot?.pains ?? []}
              checklist={checklist}
              transcript={transcript}
            />
          )}
      </div>
    </div>
  );
}
