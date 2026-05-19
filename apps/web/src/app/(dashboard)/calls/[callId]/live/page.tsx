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
import { useCallUI } from "@/stores/use-call-ui";
import { useLiveCall } from "@/stores/use-live-call";
import { useLiveCallInit } from "@/hooks/use-live-call-init";
import { usePersona } from "@/hooks/use-persona";
import { useLiveCallStream } from "@/lib/data/hooks";
import { LIVE_BANT_SIGNALS } from "@/lib/mock-data";
import type { KBAsset, PodRole } from "@/types";

const placeholderKBResults: KBAsset[] = [
  { id: "kb1", title: "SOC 2 Compliance Automation — Deck v3", type: "deck", tags: ["compliance", "SOC 2"], lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), effectivenessScore: 0.82, uploadedAt: "2026-01-10", version: 3 },
  { id: "kb2", title: "Delta Finance Before/After Case Study", type: "case-study", tags: ["compliance", "fintech"], effectivenessScore: 0.91, uploadedAt: "2026-02-05", version: 1 },
];

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
  useLiveCallInit(callId);
  useLiveCallStream(callId, true);

  const transcript = useLiveCall((s) => s.transcript);
  const pendingNudges = useLiveCall((s) => s.pendingNudges);
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

  const keywords = ["compliance", "SOC 2", "audit", "ESG", "Form ADV", "continuous compliance"];

  const placeholderSentiment = Array.from({ length: 20 }, (_, i) => ({
    timestamp: i * 10,
    aeScore: 0.4 + Math.sin(i / 3) * 0.2,
    customerScore: 0.3 + Math.cos(i / 4) * 0.25,
  }));

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
        <span className="text-sm font-medium text-foreground">Meridian Trust</span>
        <span className="text-sm text-muted-foreground font-mono">{formatElapsed(elapsedSeconds)}</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">Sentiment:</span>
        <Badge variant="success">Positive</Badge>
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
            <TranscriptViewer
              events={transcript}
              keywords={keywords}
              isLive
              className="flex-1"
            />
            <div className="border-t border-border p-3 shrink-0 space-y-2">
              <SignalLog signals={LIVE_BANT_SIGNALS} />
              <SentimentTimeline data={placeholderSentiment} className="h-16" />
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Knowledge</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {placeholderKBResults.map((asset) => (
                <KBAssetCard key={asset.id} asset={asset} onSelect={() => {}} />
              ))}
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
                <SignalLog signals={LIVE_BANT_SIGNALS} />
              </div>
            </TabsContent>
            <TabsContent value="kb" className="flex-1 overflow-y-auto p-3 m-0 space-y-3">
              {placeholderKBResults.map((asset) => (
                <KBAssetCard key={asset.id} asset={asset} onSelect={() => {}} />
              ))}
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
