"use client";

import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { CallDetailTabs } from "@/components/calls/call-detail-tabs";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";
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
  initialTab?: "brief" | "post-dc";
}

export function CallDetailView({ callId, initialTab = "brief" }: CallDetailViewProps) {
  const { data: call, isLoading } = useCall(callId);
  const preRecord = useDcImportsStore((s) =>
    findPreDcRecordForCall(s.preDcRecords, callId, call?.accountName)
  );
  const isEditingLayout = useDashboardLayoutStore((s) => s.isEditing);
  const setEditingLayout = useDashboardLayoutStore((s) => s.setEditing);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto w-full">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
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

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/calls" aria-label="Back to calls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{call.accountName}</h1>
            {call.leadName && (
              <span className="text-sm text-muted-foreground">
                · {call.leadName}
                {call.leadTitle ? ` (${call.leadTitle})` : ""}
              </span>
            )}
            <Badge variant="secondary">Pre-DC Brief</Badge>
            {call.annualRevenue && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {call.annualRevenue} revenue
              </Badge>
            )}
            <AIGeneratedBadge />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {call.discoveryCallDatePkt && call.discoveryCallTimePkt ? (
              <>
                Discovery call: {call.discoveryCallDatePkt} at {call.discoveryCallTimePkt} (PKT)
              </>
            ) : (
              new Date(call.scheduledAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            )}
          </p>
        </div>
        {isEditingLayout ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setEditingLayout(false)}
          >
            Done
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditingLayout(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Customize layout
          </Button>
        )}
      </div>

      <CallDetailTabs
        callId={callId}
        initialTab={initialTab}
        discoveryQuestions={discoveryQuestions}
        bant={call.bant ?? { budget: "unknown", authority: "unknown", need: "unknown", timeline: "unknown" }}
        call={call}
        accountSnapshot={accountSnapshot}
      />
    </div>
  );
}
