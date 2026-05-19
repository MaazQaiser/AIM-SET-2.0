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
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";
import { useCallUI } from "@/stores/use-call-ui";
import { useLiveCall } from "@/stores/use-live-call";
import { useLiveCallInit } from "@/hooks/use-live-call-init";
import { usePersona } from "@/hooks/use-persona";
import { useLiveCallStream, useCall, useKbAssets } from "@/lib/data/hooks";
import type { PodRole } from "@/types";

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
  const persona = usePersona();
  const { data: call } = useCall(callId);
  const { data: kbAssets = [] } = useKbAssets();
  useLiveCallInit(callId);
  useLiveCallStream(callId, true);

  const transcript = useLiveCall((s) => s.transcript);
  const pendingNudges = useLiveCall((s) => s.pendingNudges);
  const bantSignals = useLiveCall((s) => s.bantSignals);
  const elapsedSeconds = useLiveCall((s) => s.elapsedSeconds);
  const dismissNudge = useLiveCall((s) => s.dismissNudge);
  const acceptNudge = useLiveCall((s) => s.acceptNudge);
  const { activePanel, setActivePanel } = useCallUI();

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
    return [...new Set(fromTranscript)];
  }, [transcript]);

  const sentimentData = useMemo(
    () =>
      transcript.map((e, i) => ({
        timestamp: e.timestamp ?? i * 10,
        aeScore: e.speakerRole === "ae" ? 0.6 : 0.4,
        customerScore: e.speakerRole === "customer" ? 0.6 : 0.4,
      })),
    [transcript]
  );

  const accountName = call?.accountName ?? "Live call";

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
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="hidden lg:grid lg:grid-cols-[1fr_320px_320px] h-full divide-x divide-border">
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
            </div>
            {visibleNudges.length > 0 && (
              <div className="p-3 border-b border-border space-y-2 shrink-0">
                {visibleNudges.map((n) => (
                  <NudgeAlert
                    key={n.id}
                    nudge={n}
                    onAccept={(id) => acceptNudge(id)}
                    onDismiss={(id) => dismissNudge(id)}
                  />
                ))}
              </div>
            )}
            {transcript.length > 0 ? (
              <TranscriptViewer events={transcript} keywords={keywords} isLive className="flex-1" />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">
                  Waiting for transcript. Connect your conferencing integration or start capture.
                </p>
              </div>
            )}
            <div className="border-t border-border p-3 shrink-0 space-y-2">
              <SignalLog signals={bantSignals} />
              {sentimentData.length > 0 && (
                <SentimentTimeline data={sentimentData} className="h-16" />
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Knowledge</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {kbAssets.length > 0 ? (
                kbAssets.slice(0, 8).map((asset) => (
                  <KBAssetCard key={asset.id} asset={asset} onSelect={() => {}} />
                ))
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No KB matches yet"
                  description="Relevant assets appear as the live agent detects topics."
                />
              )}
            </div>
          </div>

          <BotChatPanel callId={callId} />
        </div>

        <div className="lg:hidden h-full flex flex-col">
          <Tabs
            value={activePanel ?? "transcript"}
            onValueChange={(v: string) => setActivePanel(v as "transcript" | "kb" | "chat")}
            className="flex flex-col h-full"
          >
            <TabsList className="rounded-none border-b border-border w-full justify-start px-2 h-10 bg-transparent">
              <TabsTrigger value="transcript" className="text-xs">Transcript</TabsTrigger>
              <TabsTrigger value="kb" className="text-xs">Knowledge</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">Bot chat</TabsTrigger>
            </TabsList>

            <TabsContent value="transcript" className="flex-1 overflow-hidden m-0 flex flex-col">
              {visibleNudges.length > 0 && (
                <div className="p-3 border-b space-y-2 shrink-0">
                  {visibleNudges.map((n) => (
                    <NudgeAlert
                      key={n.id}
                      nudge={n}
                      onAccept={(id) => acceptNudge(id)}
                      onDismiss={(id) => dismissNudge(id)}
                    />
                  ))}
                </div>
              )}
              <TranscriptViewer events={transcript} keywords={keywords} isLive className="flex-1" />
              <div className="p-2 border-t shrink-0">
                <SignalLog signals={bantSignals} />
              </div>
            </TabsContent>
            <TabsContent value="kb" className="flex-1 overflow-y-auto p-3 m-0 space-y-3">
              {kbAssets.length > 0 ? (
                kbAssets.slice(0, 8).map((asset) => (
                  <KBAssetCard key={asset.id} asset={asset} onSelect={() => {}} />
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

