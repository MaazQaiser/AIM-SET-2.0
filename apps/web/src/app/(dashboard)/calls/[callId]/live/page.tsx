"use client";

import { LiveCallWorkspace } from "@/components/live/live-call-workspace";
import { filterKeywordTerms } from "@/lib/live/keyword-filter";
import { postSuggestionFeedback } from "@/lib/live-suggestion-feedback";
import { useCallStream } from "@/hooks/use-call-stream";
import { useLiveCallInit } from "@/hooks/use-live-call-init";
import { usePersona } from "@/hooks/use-persona";
import { useCall, useCallBrief, usePostCallReview } from "@/lib/data/hooks";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import { useCallUI } from "@/stores/use-call-ui";
import { useLiveCall } from "@/stores/use-live-call";
import type { PodRole } from "@/types";
import { use, useMemo } from "react";

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

  const transcript = useLiveCall((s) => s.transcript);
  const pendingNudges = useLiveCall((s) => s.pendingNudges);
  const elapsedSeconds = useLiveCall((s) => s.elapsedSeconds);
  const dismissNudge = useLiveCall((s) => s.dismissNudge);
  const acceptNudge = useLiveCall((s) => s.acceptNudge);
  const intentSnapshot = useLiveCall((s) => s.intentSnapshot);
  const keywordStats = useLiveCall((s) => s.keywordStats);
  const sentimentAE = useLiveCall((s) => s.sentimentAE);
  const sentimentCustomer = useLiveCall((s) => s.sentimentCustomer);
  const sentimentShift = useLiveCall((s) => s.sentimentShift);
  const isConnected = useLiveCall((s) => s.isConnected);
  const objections = useLiveCall((s) => s.objections);
  const unansweredQuestions = useLiveCall((s) => s.unansweredQuestions);
  const suggestionLog = useLiveCall((s) => s.suggestionLog);
  const checklistState = useLiveCall((s) => s.checklistState);
  const { activePanel, setActivePanel } = useCallUI();

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
  const leadName = call?.leadName;
  const intentLabel =
    intentSnapshot?.intent?.display ?? intentSnapshot?.intent?.label;

  return (
    <LiveCallWorkspace
      callId={callId}
      call={call}
      brief={brief}
      hasReview={Boolean(postReview)}
      accountName={accountName}
      leadName={leadName}
      transcript={transcript}
      keywords={keywords}
      visibleNudges={visibleNudges}
      objections={objections}
      unansweredQuestions={unansweredQuestions}
      suggestionLog={suggestionLog}
      checklist={checklistDisplay}
      intentLabel={intentLabel}
      intentSnapshot={intentSnapshot}
      keywordStats={keywordStats}
      sentimentAE={sentimentAE}
      sentimentCustomer={sentimentCustomer}
      sentimentShift={sentimentShift}
      elapsedSeconds={elapsedSeconds}
      isConnected={isConnected}
      viewerRole={viewerRole}
      activePanel={activePanel}
      onPanelChange={setActivePanel}
      onAcceptNudge={(id) => void handleAcceptNudge(id)}
      onDismissNudge={(id) => void handleDismissNudge(id)}
    />
  );
}
