"use client";

import { ArrowLeft, Edit3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PodMemberBadge } from "@/components/pod-member-badge";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { CallDetailTabs } from "@/components/calls/call-detail-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCall } from "@/lib/data/hooks";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { discoveryQuestionsFromPreDc, slugifyCompany } from "@/lib/dc-notes/build-from-import";
import { preDcField } from "@/types/dc-notes";

interface CallDetailViewProps {
  callId: string;
}

export function CallDetailView({ callId }: CallDetailViewProps) {
  const { data: call, isLoading } = useCall(callId);
  const preRecord = useDcImportsStore((s) =>
    s.preDcRecords.find((r) => slugifyCompany(preDcField(r, "companyName")) === callId)
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
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
      ].filter((row) => row.value)
    : [
        ...(call.industry ? [{ label: "Industry", value: call.industry }] : []),
        { label: "Deal stage", value: call.dealStage ?? "Discovery" },
      ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
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
        <Button variant="outline" size="sm">
          <Edit3 className="h-3.5 w-3.5" />
          Edit brief
        </Button>
        {(call.status === "upcoming" || call.status === "live") && (
          <Button asChild>
            <Link href={`/calls/${call.id}/live`}>
              {call.status === "live" ? "Join live" : "Join call"}
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Account snapshot</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {accountSnapshot.map((row) => (
                <div key={row.label}>
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-sm font-medium leading-snug">{row.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          {(call.annualRevenue || call.employeeCount || call.icpBucket) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Company metrics</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {call.annualRevenue && (
                  <div>
                    <p className="text-xs text-muted-foreground">Annual revenue</p>
                    <p className="text-lg font-semibold text-primary">{call.annualRevenue}</p>
                    {call.annualRevenueRaw && call.annualRevenueRaw !== call.annualRevenue && (
                      <p className="text-[10px] text-muted-foreground">{call.annualRevenueRaw}</p>
                    )}
                  </div>
                )}
                {call.employeeCount && (
                  <div>
                    <p className="text-xs text-muted-foreground">Employees</p>
                    <p className="text-sm font-medium">{call.employeeCount}</p>
                  </div>
                )}
                {call.icpBucket && (
                  <div>
                    <p className="text-xs text-muted-foreground">ICP bucket</p>
                    <p className="text-sm font-medium">{call.icpBucket}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <CallDetailTabs
          callId={callId}
          discoveryQuestions={discoveryQuestions}
          bant={call.bant ?? { budget: "unknown", authority: "unknown", need: "unknown", timeline: "unknown" }}
        />
      </div>
    </div>
  );
}
