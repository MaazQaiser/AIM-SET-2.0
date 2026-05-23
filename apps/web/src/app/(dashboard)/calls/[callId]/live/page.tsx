"use client";

import { BotChatPanel } from "@/components/bot-chat-panel";
import { DemoTranscriptPlayer } from "@/components/live/demo-transcript-player";
import { DiscoveryChecklistPanel } from "@/components/live/discovery-checklist-panel";
import { FocusAreasBar } from "@/components/live/focus-areas-bar";
import { IntentPainStream } from "@/components/live/intent-pain-stream";
import { LiveCollapsibleSection } from "@/components/live/live-collapsible-section";
import { LiveKbAssetCard } from "@/components/live/live-kb-asset-card";
import { LiveCallActionSummary } from "@/components/live/live-call-action-summary";
import { LiveInsightsDock } from "@/components/live/live-insights-dock";
import { LivePanelColumn } from "@/components/live/live-panel-column";
import { PostDcReviewScreen } from "@/components/post-dc/post-dc-review-screen";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { RecallBotLauncher } from "@/components/live/recall-bot-launcher";
import { NudgeAlert } from "@/components/nudge-alert";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { filterKeywordTerms } from "@/lib/live/keyword-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallStream } from "@/hooks/use-call-stream";
import { useLiveCallInit } from "@/hooks/use-live-call-init";
import { usePersona } from "@/hooks/use-persona";
import { useCall, useCallBrief, useKbAssets, usePostCallReview } from "@/lib/data/hooks";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import { isUsefulLiveKeyword } from "@/lib/live/keyword-filter";
import { postSuggestionFeedback } from "@/lib/live-suggestion-feedback";
import { useCallUI } from "@/stores/use-call-ui";
import { useLiveCall } from "@/stores/use-live-call";
import type { PodRole } from "@/types";
import { ArrowLeft } from "lucide-react";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface LivePageParams {
  params: Promise<{ callId: string }>;
}

export default function LiveCallPage({ params }: LivePageParams) {
  const { callId } = use(params);
  useLiveCallInit(callId);
  useCallStream({ callId, enabled: Boolean(callId) });

  const persona = usePersona();
  const { data: call } = useCall(callId);
  const { data: brief } = useCallBrief(callId);
  const { data: postReview } = usePostCallReview(callId);
  const { data: kbAssets = [] } = useKbAssets();

  const transcript = useLiveCall((s) => s.transcript);
  const pendingNudges = useLiveCall((s) => s.pendingNudges);
  const bantSignals = useLiveCall((s) => s.bantSignals);
  const elapsedSeconds = useLiveCall((s) => s.elapsedSeconds);
  const dismissNudge = useLiveCall((s) => s.dismissNudge);
  const acceptNudge = useLiveCall((s) => s.acceptNudge);
  const intentSnapshot = useLiveCall((s) => s.intentSnapshot);
  const keywordStats = useLiveCall((s) => s.keywordStats);
  const focusAreas = useLiveCall((s) => s.focusAreas);
  const sentimentAE = useLiveCall((s) => s.sentimentAE);
  const sentimentCustomer = useLiveCall((s) => s.sentimentCustomer);
  const sentimentShift = useLiveCall((s) => s.sentimentShift);
  const isConnected = useLiveCall((s) => s.isConnected);
  const surfacedKbAssets = useLiveCall((s) => s.surfacedKbAssets);
  const objections = useLiveCall((s) => s.objections);
  const unansweredQuestions = useLiveCall((s) => s.unansweredQuestions);
  const suggestionLog = useLiveCall((s) => s.suggestionLog);
  const { activePanel, setActivePanel } = useCallUI();

  const kbDisplay = surfacedKbAssets.length > 0 ? surfacedKbAssets : kbAssets.slice(0, 8);

  async function handleAcceptNudge(id: string) {
    const nudge = pendingNudges.find((n) => n.id === id);
    acceptNudge(id);
    const sid = nudge?.suggestionId ?? id;
    try {
      await postSuggestionFeedback(callId, sid, "accepted");
    } catch {
      /* non-blocking */
    }
  }

  async function handleDismissNudge(id: string) {
    const nudge = pendingNudges.find((n) => n.id === id);
    dismissNudge(id);
    const sid = nudge?.suggestionId ?? id;
    try {
      await postSuggestionFeedback(callId, sid, "dismissed");
    } catch {
      /* non-blocking */
    }
  }

  const checklistSeed = useMemo(() => (call ? seedChecklistFromCall(call) : null), [call]);
  const checklistState = useLiveCall((s) => s.checklistState);
  const checklistDisplay = checklistState ?? checklistSeed;

  const viewerRole: PodRole | null = persona === "leadership" ? null : "ae";

  const visibleNudges = useMemo(
    () =>
      viewerRole === null ? pendingNudges : pendingNudges.filter((n) => n.role === viewerRole),
    [pendingNudges, viewerRole]
  );

  const keywords = useMemo(() => {
    const fromTranscript = transcript.flatMap((e) => e.keywords ?? []);
    const fromGlobal = keywordStats?.global_top.map((k) => k.term) ?? [];
    return filterKeywordTerms([...fromTranscript, ...fromGlobal]);
  }, [transcript, keywordStats]);

  const accountName = call?.accountName ?? "Live call";
  const intentLabel =
    intentSnapshot?.intent?.display ?? intentSnapshot?.intent?.label;
  const nextActions = intentSnapshot?.next_actions ?? [];
  const focusAreasFiltered = useMemo(
    () => focusAreas.filter((a) => isUsefulLiveKeyword(a) || a.includes(" ") || a.length > 12),
    [focusAreas]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 shrink-0">
        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
          <Link href={`/calls/${callId}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Badge variant="live" aria-label="Live call in progress">
          Live
        </Badge>
        <span className="text-sm font-medium text-foreground">{accountName}</span>
        <span className="text-sm text-muted-foreground font-mono">
          {formatElapsed(elapsedSeconds)}
        </span>
        {!isConnected && <span className="text-xs text-muted-foreground">Connecting stream…</span>}
        <div className="ml-auto flex min-w-0 items-center gap-2 flex-wrap justify-end">
          <CallWrapUpActions
            callId={callId}
            accountName={accountName}
            hasReview={Boolean(postReview)}
            showLiveLink={false}
            variant="compact"
          />
          <RecallBotLauncher callId={callId} meetingUrl={call?.meetingUrl} />
          <DemoTranscriptPlayer callId={callId} isConnected={isConnected} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="hidden xl:grid xl:grid-cols-[minmax(220px,0.42fr)_minmax(260px,300px)_minmax(200px,0.22fr)_minmax(180px,0.2fr)_minmax(260px,0.28fr)] h-full divide-x divide-border">
          <LivePanelColumn
            title="Transcript"
            defaultOpen
            scrollable={false}
            className="min-w-0"
            bodyClassName="p-0"
          >
            <FocusAreasBar
              areas={focusAreasFiltered}
              intentLabel={intentLabel}
              bantSignals={bantSignals}
            />
            {visibleNudges.length > 0 && (
              <div className="shrink-0 px-3 py-2 space-y-2 border-b border-border">
                {visibleNudges.map((n) => (
                  <NudgeAlert
                    key={n.id}
                    nudge={n}
                    onAccept={(id) => void handleAcceptNudge(id)}
                    onDismiss={(id) => void handleDismissNudge(id)}
                  />
                ))}
              </div>
            )}
            {transcript.length > 0 ? (
              <TranscriptViewer
                events={transcript}
                keywords={keywords}
                isLive
                className="flex-1 min-h-0"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8 px-3">
                Waiting for transcript. Start Recall above or play a demo transcript.
              </p>
            )}
          </LivePanelColumn>

          <LivePanelColumn title="Live insights" defaultOpen className="min-w-0">
            <LiveCallActionSummary
              intentLabel={intentLabel}
              intent={intentSnapshot?.intent ?? null}
              pains={intentSnapshot?.pains ?? []}
              nextActions={nextActions}
              sentimentAE={sentimentAE}
              sentimentCustomer={sentimentCustomer}
              sentimentShift={sentimentShift}
              checklist={checklistDisplay}
            />
            <LiveInsightsDock
              unansweredQuestions={unansweredQuestions}
              objections={objections}
              suggestionLog={suggestionLog}
              bantSignals={bantSignals}
              keywordStats={keywordStats}
              sentimentAE={sentimentAE}
              sentimentCustomer={sentimentCustomer}
              sentimentShift={sentimentShift}
            />
          </LivePanelColumn>

          <LivePanelColumn title="Intent & pain" defaultOpen className="min-w-0">
            <LiveCollapsibleSection
              title="Intent & pain stream"
              defaultOpen
              summary={
                intentLabel
                  ? intentLabel.replace(/_/g, " ")
                  : "Updates as the customer speaks"
              }
            >
              <IntentPainStream
                intent={intentSnapshot?.intent ?? null}
                pains={intentSnapshot?.pains ?? []}
                nextActions={nextActions}
              />
            </LiveCollapsibleSection>
            <div className="mt-3">
              <DiscoveryChecklistPanel state={checklistDisplay} />
            </div>
          </LivePanelColumn>

          <LivePanelColumn title="Knowledge" defaultOpen className="min-w-0">
            {kbDisplay.length > 0 ? (
              <div className="space-y-2">
                {kbDisplay.map((asset) => (
                  <LiveKbAssetCard
                    key={asset.id}
                    asset={
                      "tags" in asset
                        ? asset
                        : {
                            id: asset.id,
                            title: asset.title,
                            type: (asset.type as "case-study") ?? "case-study",
                            tags: [],
                            uploadedAt: new Date().toISOString(),
                            version: 1,
                          }
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No KB matches yet"
                description="Relevant assets appear when topics spike. Open in this window or a new tab to present."
              />
            )}
          </LivePanelColumn>

          <BotChatPanel
            callId={callId}
            phase="live"
            className="min-w-0 h-full"
            accountName={accountName}
            brief={brief}
            intentLabel={intentLabel}
            painCount={intentSnapshot?.pains?.length ?? 0}
            checklist={checklistDisplay}
            transcriptLineCount={transcript.length}
            hasObjections={objections.length > 0}
          />
        </div>

        <div className="xl:hidden h-full flex flex-col">
          <FocusAreasBar
            areas={focusAreas}
            intentLabel={intentLabel}
            bantSignals={bantSignals}
          />
          <Tabs
            value={activePanel ?? "transcript"}
            onValueChange={(v: string) =>
              setActivePanel(
                v as "transcript" | "insights" | "signals" | "kb" | "chat" | "wrap-up"
              )
            }
            className="flex flex-col h-full flex-1 min-h-0"
          >
            <TabsList className="rounded-none border-b border-border w-full justify-start px-2 h-10 bg-transparent shrink-0 overflow-x-auto">
              <TabsTrigger value="transcript" className="text-xs">
                Transcript
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs">
                Insights
              </TabsTrigger>
              <TabsTrigger value="signals" className="text-xs">
                Intent
              </TabsTrigger>
              <TabsTrigger value="kb" className="text-xs">
                Knowledge
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                Pod chat
              </TabsTrigger>
              <TabsTrigger value="wrap-up" className="text-xs">
                Wrap-up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transcript" className="flex-1 overflow-hidden m-0 flex flex-col">
              {visibleNudges.length > 0 && (
                <div className="p-3 border-b space-y-2 shrink-0">
                  {visibleNudges.map((n) => (
                    <NudgeAlert
                      key={n.id}
                      nudge={n}
                      onAccept={(id) => void handleAcceptNudge(id)}
                      onDismiss={(id) => void handleDismissNudge(id)}
                    />
                  ))}
                </div>
              )}
              <TranscriptViewer
                events={transcript}
                keywords={keywords}
                isLive
                className="flex-1 min-h-0"
              />
            </TabsContent>
            <TabsContent value="insights" className="flex-1 overflow-y-auto p-3 m-0 space-y-3">
              <LiveCallActionSummary
                intentLabel={intentLabel}
                intent={intentSnapshot?.intent ?? null}
                pains={intentSnapshot?.pains ?? []}
                nextActions={nextActions}
                sentimentAE={sentimentAE}
                sentimentCustomer={sentimentCustomer}
                sentimentShift={sentimentShift}
                checklist={checklistDisplay}
              />
              <LiveInsightsDock
                unansweredQuestions={unansweredQuestions}
                objections={objections}
                suggestionLog={suggestionLog}
                bantSignals={bantSignals}
                keywordStats={keywordStats}
                sentimentAE={sentimentAE}
                sentimentCustomer={sentimentCustomer}
                sentimentShift={sentimentShift}
              />
            </TabsContent>
            <TabsContent value="signals" className="flex-1 overflow-y-auto p-3 m-0 space-y-4">
              <IntentPainStream
                intent={intentSnapshot?.intent ?? null}
                pains={intentSnapshot?.pains ?? []}
                nextActions={nextActions}
                nextActions={nextActions}
              />
              <DiscoveryChecklistPanel state={checklistDisplay} />
            </TabsContent>
            <TabsContent value="kb" className="flex-1 overflow-y-auto p-3 m-0 space-y-2">
              {kbDisplay.length > 0 ? (
                kbDisplay.map((asset) => (
                  <LiveKbAssetCard
                    key={asset.id}
                    asset={
                      "tags" in asset
                        ? asset
                        : {
                            id: asset.id,
                            title: asset.title,
                            type: (asset.type as "case-study") ?? "case-study",
                            tags: [],
                            uploadedAt: new Date().toISOString(),
                            version: 1,
                          }
                    }
                  />
                ))
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No KB matches yet"
                  description="Open assets in this window or a new tab to present."
                />
              )}
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
                checklist={checklistDisplay}
                transcriptLineCount={transcript.length}
                hasObjections={objections.length > 0}
              />
            </TabsContent>
            <TabsContent value="wrap-up" className="flex-1 overflow-y-auto m-0 p-0">
              <PostDcReviewScreen callId={callId} embedded />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
