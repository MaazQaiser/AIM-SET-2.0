"use client";

import { CallDetailStickyHeader } from "@/components/calls/call-detail-sticky-header";
import { CallDetailTabs } from "@/components/calls/call-detail-tabs";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";
import { useMainScrollCompact } from "@/hooks/use-main-scroll-compact";
import { useCall } from "@/lib/data/hooks";
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
  const compact = useMainScrollCompact(32);
  const { data: call, isLoading } = useCall(callId);
  const preRecord = useDcImportsStore((s) =>
    findPreDcRecordForCall(s.preDcRecords, callId, call?.accountName)
  );
  const isEditingLayout = useDashboardLayoutStore((s) => s.isEditing);
  const setEditingLayout = useDashboardLayoutStore((s) => s.setEditing);

  if (isLoading) {
    return (
      <div className="px-4 pt-2 pb-4 max-w-[1600px] mx-auto w-full">
        <Skeleton className="h-16 w-full rounded-lg mb-4" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <EmptyState
          title="Call not found"
          description="This call may have been removed or the link is invalid."
          action={{ label: "Back to calls", href: "/calls" }}
        />
      </div>
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

  return (
    <div className="call-detail-page w-full pt-0 pb-8 min-h-0 text-[0.9375rem] leading-relaxed">
      <CallDetailStickyHeader
        call={call}
        scheduleText={scheduleText}
        bant={
          call.bant ?? {
            budget: "unknown",
            authority: "unknown",
            need: "unknown",
            timeline: "unknown",
          }
        }
        compact={compact}
        showJoinCall={showJoinCall}
        isEditingLayout={isEditingLayout}
        onToggleLayout={() => setEditingLayout(!isEditingLayout)}
      />
      <div className="px-16 md:px-24 lg:px-32 max-w-[1480px] mx-auto w-full">
      <CallDetailTabs
        callId={callId}
        discoveryQuestions={discoveryQuestions}
        bant={
          call.bant ?? {
            budget: "unknown",
            authority: "unknown",
            need: "unknown",
            timeline: "unknown",
          }
        }
        call={call}
        accountSnapshot={accountSnapshot}
      />
      </div>
    </div>
  );
}
