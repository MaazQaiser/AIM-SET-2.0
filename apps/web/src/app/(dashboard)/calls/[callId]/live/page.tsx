"use client";

import { LiveCallWorkspace } from "@/components/live/live-call-workspace";
import { filterKeywordTerms } from "@/lib/live/keyword-filter";
import { postSuggestionFeedback } from "@/lib/live-suggestion-feedback";
import { useCallStream } from "@/hooks/use-call-stream";
import { useLiveCallInit } from "@/hooks/use-live-call-init";
import { usePersona } from "@/hooks/use-persona";
import { useCall, useCallBrief, usePostCallReview } from "@/lib/data/hooks";
import { LiveCallPageLoader } from "@/components/layout/page-loaders";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import { useCallUI } from "@/stores/use-call-ui";
import { useLiveCall } from "@/stores/use-live-call";
import type { CallBrief } from "@/lib/brief-types";
import type { Call } from "@/types";
import type { PodRole } from "@/types";
import { use, useCallback, useMemo } from "react";

interface LivePageParams {
  params: Promise<{ callId: string }>;
}

interface LiveCallPageContentProps {
  callId: string;
  call: Call;
  brief?: CallBrief | null;
  hasReview: boolean;
}

function LiveCallPageContent({ callId, call, brief, hasReview }: LiveCallPageContentProps) {
  const persona = usePersona();
  const transcript = useLiveCall((s) => s.transcript);
  const pendingNudges = useLiveCall((s) => s.pendingNudges);
  const dismissNudge = useLiveCall((s) => s.dismissNudge);
  const acceptNudge = useLiveCall((s) => s.acceptNudge);
  const intentSnapshot = useLiveCall((s) => s.intentSnapshot);
  const keywordStats = useLiveCall((s) => s.keywordStats);
  const sentimentAE = useLiveCall((s) => s.sentimentAE);
  const salesRepTone = useLiveCall((s) => s.salesRepTone);
  const sentimentCustomer = useLiveCall((s) => s.sentimentCustomer);
  const customerSentiment = useLiveCall((s) => s.customerSentiment);
  const sentimentShift = useLiveCall((s) => s.sentimentShift);
  const sentimentSignals = useLiveCall((s) => s.sentimentSignals);
  const objections = useLiveCall((s) => s.objections);
  const unansweredQuestions = useLiveCall((s) => s.unansweredQuestions);
  const suggestionLog = useLiveCall((s) => s.suggestionLog);
  const bantSignals = useLiveCall((s) => s.bantSignals);
  const checklistState = useLiveCall((s) => s.checklistState);
  const { activePanel, setActivePanel } = useCallUI();

  const handleAcceptNudge = useCallback(
    async (id: string) => {
      const nudge = pendingNudges.find((n) => n.id === id);
      acceptNudge(id);
      const sid = nudge?.suggestionId ?? id;
      try {
        await postSuggestionFeedback(callId, sid, "accepted");
      } catch {
        /* non-blocking */
      }
    },
    [acceptNudge, callId, pendingNudges]
  );

  const handleDismissNudge = useCallback(
    async (id: string) => {
      const nudge = pendingNudges.find((n) => n.id === id);
      dismissNudge(id);
      const sid = nudge?.suggestionId ?? id;
      try {
        await postSuggestionFeedback(callId, sid, "dismissed");
      } catch {
        /* non-blocking */
      }
    },
    [callId, dismissNudge, pendingNudges]
  );

  const checklistSeed = useMemo(() => seedChecklistFromCall(call), [call]);
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

  const accountName = call.accountName ?? "Live call";
  const leadName = call.leadName;
  const intentLabel = intentSnapshot?.intent?.display ?? intentSnapshot?.intent?.label;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <LiveCallWorkspace
        callId={callId}
        call={call}
        brief={brief}
        hasReview={hasReview}
        accountName={accountName}
        leadName={leadName}
        transcript={transcript}
        keywords={keywords}
        visibleNudges={visibleNudges}
        objections={objections}
        unansweredQuestions={unansweredQuestions}
        suggestionLog={suggestionLog}
        bantSignals={bantSignals}
        checklist={checklistDisplay}
        intentLabel={intentLabel}
        intentSnapshot={intentSnapshot}
        keywordStats={keywordStats}
        sentimentAE={sentimentAE}
        salesRepTone={salesRepTone}
        sentimentCustomer={sentimentCustomer}
        customerSentiment={customerSentiment}
        sentimentShift={sentimentShift}
        sentimentSignals={sentimentSignals}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onAcceptNudge={(id) => void handleAcceptNudge(id)}
        onDismissNudge={(id) => void handleDismissNudge(id)}
      />
    </div>
  );
}

export default function LiveCallPage({ params }: LivePageParams) {
  const { callId } = use(params);
  useLiveCallInit(callId);
  useCallStream({ callId, enabled: Boolean(callId) });

  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const { data: call, isLoading: callLoading } = useCall(callId);
  const { data: brief } = useCallBrief(callId);
  const { data: postReview } = usePostCallReview(callId);

  if ((!importsHydrated || callLoading) && !call) {
    return <LiveCallPageLoader />;
  }

  if (!call) {
    return <LiveCallPageLoader />;
  }

  return (
    <LiveCallPageContent
      callId={callId}
      call={call}
      brief={brief}
      hasReview={Boolean(postReview)}
    />
  );
}
