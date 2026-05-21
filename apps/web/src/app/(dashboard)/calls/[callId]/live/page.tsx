"use client";

import { use, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { BotChatPanel } from "@/components/bot-chat-panel";
import { NudgeAlert } from "@/components/nudge-alert";
import { SentimentTimeline } from "@/components/sentiment-timeline";
import { KBAssetCard } from "@/components/kb-asset-card";
import { Button } from "@/components/ui/button";
import { SignalLog } from "@/components/live/signal-log";
import { FocusAreasBar } from "@/components/live/focus-areas-bar";
import { IntentPainStream } from "@/components/live/intent-pain-stream";
import { KeywordFrequencyPanel } from "@/components/live/keyword-frequency-panel";
import { DiscoveryChecklistPanel } from "@/components/live/discovery-checklist-panel";
import { ObjectionCard } from "@/components/live/objection-card";
import { UnansweredQuestionsList } from "@/components/live/unanswered-questions-list";
import { SuggestionLog } from "@/components/live/suggestion-log";
import { DemoTranscriptPlayer } from "@/components/live/demo-transcript-player";
import { postSuggestionFeedback } from "@/lib/live-suggestion-feedback";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";
import { useCallUI } from "@/stores/use-call-ui";
import { useLiveCall } from "@/stores/use-live-call";
import { useLiveCallInit } from "@/hooks/use-live-call-init";
import { usePersona } from "@/hooks/use-persona";
import { useCallStream } from "@/hooks/use-call-stream";
import { useCall, useKbAssets } from "@/lib/data/hooks";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import type { PodRole } from "@/types";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sentimentToScore(label?: string): number {
  if (label === "positive") return 0.55;
  if (label === "negative") return -0.55;
  return 0;
}

interface LivePageParams {
  params: Promise<{ callId: string }>;
}

export default function LiveCallPage({ params }: LivePageParams) {
  const { callId } = use(params);
  const persona = usePersona();
  const { data: call } = useCall(callId);
  const { data: kbAssets = [] } = useKbAssets();
  useLiveCallInit(callId);
  useCallStream({ callId, enabled: true });

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
      viewerRole === null
        ? pendingNudges
        : pendingNudges.filter((n) => n.role === viewerRole),
    [pendingNudges, viewerRole]
  );

  const keywords = useMemo(() => {
    const fromTranscript = transcript.flatMap((e) => e.keywords ?? []);
    const fromGlobal = keywordStats?.global_top.map((k) => k.term) ?? [];
    return [...new Set([...fromTranscript, ...fromGlobal])];
  }, [transcript, keywordStats]);

  const sentimentData = useMemo(() => {
    if (transcript.length === 0) {
      return [];
    }
    let rollingAe = sentimentAE;
    let rollingCustomer = sentimentCustomer;
    return transcript.map((e, i) => {
      const ts = e.timestamp ?? i * 10;
      if (e.speakerRole === "customer") {
        rollingCustomer = sentimentToScore(e.sentiment) || rollingCustomer;
      } else if (e.speakerRole === "ae" || e.speakerRole === "se" || e.speakerRole === "designer") {
        rollingAe = sentimentToScore(e.sentiment) || rollingAe;
      }
      return {
        timestamp: ts,
        aeScore: rollingAe,
        customerScore: rollingCustomer,
      };
    });
  }, [transcript, sentimentAE, sentimentCustomer]);

  const accountName = call?.accountName ?? "Live call";
  const intentLabel = intentSnapshot?.intent?.label;

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
        <span className="text-sm text-muted-foreground font-mono">{formatElapsed(elapsedSeconds)}</span>
        {!isConnected && (
          <span className="text-xs text-muted-foreground">Connecting stream…</span>
        )}
        <DemoTranscriptPlayer callId={callId} isConnected={isConnected} />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="hidden xl:grid xl:grid-cols-[1fr_280px_260px_300px] h-full divide-x divide-border">
          <div className="flex flex-col overflow-hidden min-w-0">
            <FocusAreasBar areas={focusAreas} intentLabel={intentLabel} />
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Transcript
              </p>
            </div>
            {visibleNudges.length > 0 && (
              <div className="p-3 border-b border-border space-y-2 shrink-0">
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
              <TranscriptViewer events={transcript} keywords={keywords} isLive className="flex-1" />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">
                  Waiting for transcript. In dev, use Play demo transcript above, or connect Recall later.
                </p>
              </div>
            )}
            <div className="border-t border-border p-3 shrink-0 space-y-3">
              <UnansweredQuestionsList questions={unansweredQuestions} />
              {objections.length > 0 && (
                <div className="space-y-2">
                  {objections.slice(-2).map((o) => (
                    <ObjectionCard key={o.id} objection={o} />
                  ))}
                </div>
              )}
              <SuggestionLog entries={suggestionLog} />
              <SignalLog signals={bantSignals} />
              <KeywordFrequencyPanel stats={keywordStats} />
              {sentimentData.length > 0 && (
                <SentimentTimeline data={sentimentData} className="h-20" />
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Intent & pain
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <IntentPainStream
                intent={intentSnapshot?.intent ?? null}
                pains={intentSnapshot?.pains ?? []}
              />
            </div>
            <div className="border-t border-border p-3 shrink-0 max-h-[45%] overflow-y-auto">
              <DiscoveryChecklistPanel state={checklistDisplay} />
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Knowledge
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {kbDisplay.length > 0 ? (
                kbDisplay.map((asset) => (
                  <KBAssetCard
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
                    onSelect={() => {}}
                  />
                ))
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No KB matches yet"
                  description="Relevant assets appear when topics spike in conversation."
                />
              )}
            </div>
          </div>

          <BotChatPanel callId={callId} />
        </div>

        <div className="xl:hidden h-full flex flex-col">
          <FocusAreasBar areas={focusAreas} intentLabel={intentLabel} />
          <Tabs
            value={activePanel ?? "transcript"}
            onValueChange={(v: string) =>
              setActivePanel(v as "transcript" | "signals" | "kb" | "chat")
            }
            className="flex flex-col h-full flex-1 min-h-0"
          >
            <TabsList className="rounded-none border-b border-border w-full justify-start px-2 h-10 bg-transparent shrink-0">
              <TabsTrigger value="transcript" className="text-xs">
                Transcript
              </TabsTrigger>
              <TabsTrigger value="signals" className="text-xs">
                Intent
              </TabsTrigger>
              <TabsTrigger value="kb" className="text-xs">
                Knowledge
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                Bot chat
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
              <TranscriptViewer events={transcript} keywords={keywords} isLive className="flex-1" />
              <div className="p-2 border-t shrink-0 space-y-2">
                <SignalLog signals={bantSignals} />
                <KeywordFrequencyPanel stats={keywordStats} />
                {sentimentData.length > 0 && <SentimentTimeline data={sentimentData} className="h-16" />}
              </div>
            </TabsContent>
            <TabsContent value="signals" className="flex-1 overflow-y-auto p-3 m-0 space-y-4">
              <IntentPainStream
                intent={intentSnapshot?.intent ?? null}
                pains={intentSnapshot?.pains ?? []}
              />
              <DiscoveryChecklistPanel state={checklistDisplay} />
            </TabsContent>
            <TabsContent value="kb" className="flex-1 overflow-y-auto p-3 m-0 space-y-3">
              {kbDisplay.length > 0 ? (
                kbDisplay.map((asset) => (
                  <KBAssetCard
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
                    onSelect={() => {}}
                  />
                ))
              ) : (
                <EmptyState icon={BookOpen} title="No KB matches yet" description="Assets appear during the call." />
              )}
            </TabsContent>
            <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
              <BotChatPanel callId={callId} className="h-full" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
