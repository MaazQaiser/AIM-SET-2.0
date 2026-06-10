"use client";

import { CallDetailStickyHeader } from "@/components/calls/call-detail-sticky-header";
import { CallDetailTabs } from "@/components/calls/call-detail-tabs";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { briefBodyClass } from "@/components/pre-call/brief-detail-card";
import { CallDetailPageLoader } from "@/components/layout/page-loaders";
import { enrichCallBant } from "@/lib/bant/authority-from-lead";
import { buildAccountSnapshot } from "@/lib/dc-data/build-account-snapshot";
import { useCall, useCallBrief, usePostCallReview } from "@/lib/data/hooks";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import {
  discoveryQuestionsFromPreDc,
  findPreDcRecordForCall,
  sdrHandoffSummaryFromPreDc,
} from "@/lib/dc-notes/build-from-import";
import { preDcField } from "@/types/dc-notes";
import { cn } from "@/lib/cn";

interface CallDetailViewProps {
  callId: string;
}

export function CallDetailView({ callId }: CallDetailViewProps) {
  const { data: call, isLoading, isFetching } = useCall(callId);
  const { data: brief } = useCallBrief(callId);
  const { data: postCallReview } = usePostCallReview(callId);
  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const preRecord = useDcImportsStore((s) =>
    findPreDcRecordForCall(s.preDcRecords, callId, call?.accountName)
  );
  const isEditingLayout = useDashboardLayoutStore((s) => s.isEditing);
  const setEditingLayout = useDashboardLayoutStore((s) => s.setEditing);

  if ((!importsHydrated || isLoading) && !call) {
    return <CallDetailPageLoader />;
  }

  if (!call) {
    return (
      <PageShell size="default">
        <EmptyState
          title="Call not found"
          description="This call may have been removed or the link is invalid."
          action={{ label: "Back to calls", href: "/calls" }}
        />
      </PageShell>
    );
  }

  const discoveryQuestions = preRecord
    ? discoveryQuestionsFromPreDc(preRecord)
    : [
        "How are you currently handling this workflow across teams?",
        "What would success look like in the next 90 days?",
        "Who else should be involved in evaluating a solution?",
      ];
  const sdrHandoffSummary = preRecord ? sdrHandoffSummaryFromPreDc(preRecord) : [];

  const accountSnapshot = buildAccountSnapshot({ preRecord, call });

  const scheduleText =
    call.discoveryCallDatePkt && call.discoveryCallTimePkt
      ? `${call.discoveryCallDatePkt} · ${call.discoveryCallTimePkt} PKT`
      : new Date(call.scheduledAt).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

  const isWrapped = call.status === "completed" || Boolean(postCallReview);
  const showJoinCall =
    !isWrapped && (call.status === "upcoming" || call.status === "live");

  const resolvedBant = enrichCallBant(call.bant, {
    leadTitle: call.leadTitle ?? (preRecord ? preDcField(preRecord, "prospectPersona") : undefined),
    clientAttendees: brief?.clientAttendees,
  });
  const leadLinkedInUrl =
    brief?.clientAttendees?.find(
      (attendee) => attendee.name.trim().toLowerCase() === call.leadName?.trim().toLowerCase()
    )?.linkedinUrl || (preRecord ? preDcField(preRecord, "personLinkedIn") : undefined);
  const companyLinkedInUrl = preRecord ? preDcField(preRecord, "companyLinkedIn") : undefined;

  return (
    <PageShell
      size="wide"
      className={cn("call-detail-page min-h-0 space-y-4 pb-8", briefBodyClass)}
    >
      {isFetching && call ? (
        <p className="type-caption text-muted-foreground" aria-live="polite">
          Syncing latest call data…
        </p>
      ) : null}
      <CallDetailStickyHeader
        call={call}
        scheduleText={scheduleText}
        showJoinCall={showJoinCall}
        isEditingLayout={isEditingLayout}
        onToggleLayout={() => setEditingLayout(!isEditingLayout)}
        personLinkedInUrl={leadLinkedInUrl}
        companyLinkedInUrl={companyLinkedInUrl}
      />
      <CallDetailTabs
        callId={callId}
        discoveryQuestions={discoveryQuestions}
        sdrHandoffSummary={sdrHandoffSummary}
        bant={resolvedBant}
        call={call}
        accountSnapshot={accountSnapshot}
      />
    </PageShell>
  );
}
