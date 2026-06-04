"use client";

import { CallDetailStickyHeader } from "@/components/calls/call-detail-sticky-header";
import { CallDetailTabs } from "@/components/calls/call-detail-tabs";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { enrichCallBant } from "@/lib/bant/authority-from-lead";
import { useCall, useCallBrief } from "@/lib/data/hooks";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import {
  discoveryQuestionsFromPreDc,
  findPreDcRecordForCall,
} from "@/lib/dc-notes/build-from-import";
import { preDcField } from "@/types/dc-notes";

interface CallDetailViewProps {
  callId: string;
}

export function CallDetailView({ callId }: CallDetailViewProps) {
  const { data: call, isLoading } = useCall(callId);
  const { data: brief } = useCallBrief(callId);
  const preRecord = useDcImportsStore((s) =>
    findPreDcRecordForCall(s.preDcRecords, callId, call?.accountName)
  );
  const isEditingLayout = useDashboardLayoutStore((s) => s.isEditing);
  const setEditingLayout = useDashboardLayoutStore((s) => s.setEditing);

  if (isLoading) {
    return (
      <PageShell size="wide" className="call-detail-page space-y-6 pb-8">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </PageShell>
    );
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

  const accountSnapshot = preRecord
    ? [
        { label: "Industry", value: preDcField(preRecord, "industry") },
        { label: "Employees", value: preDcField(preRecord, "employeeCount") },
        { label: "Revenue", value: preDcField(preRecord, "annualRevenue") },
        { label: "ICP bucket", value: preDcField(preRecord, "icpBucket") },
        { label: "Website", value: preDcField(preRecord, "website") },
        { label: "Tech stacks", value: preDcField(preRecord, "techStacks") },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    : [
        ...(call.industry ? [{ label: "Industry", value: call.industry }] : []),
        { label: "Deal stage", value: call.dealStage ?? "Discovery" },
      ];

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

  const showJoinCall = call.status === "upcoming" || call.status === "live";

  const resolvedBant = enrichCallBant(call.bant, {
    leadTitle: call.leadTitle ?? (preRecord ? preDcField(preRecord, "prospectPersona") : undefined),
    clientAttendees: brief?.clientAttendees,
  });

  return (
    <PageShell
      size="wide"
      className="call-detail-page min-h-0 space-y-4 pb-8 text-[0.9375rem] leading-relaxed"
    >
      <CallDetailStickyHeader
        call={call}
        scheduleText={scheduleText}
        bant={resolvedBant}
        showJoinCall={showJoinCall}
        isEditingLayout={isEditingLayout}
        onToggleLayout={() => setEditingLayout(!isEditingLayout)}
      />
      <CallDetailTabs
        callId={callId}
        discoveryQuestions={discoveryQuestions}
        bant={resolvedBant}
        call={call}
        accountSnapshot={accountSnapshot}
      />
    </PageShell>
  );
}
