"use client";

import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import { AccountSnapshotCard, CompanyMetricsCard } from "@/components/calls/account-widget-cards";
import {
  PostBeforeContextCard,
  PostHeadlineCard,
} from "@/components/post-dc/post-dc-widget-cards";
import type { PostDcWidgetProps } from "@/lib/dashboard/widget-registry";
import type { CallBrief } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PostDcAccountPrepColumnProps {
  widgetProps: PostDcWidgetProps;
  brief?: CallBrief | null;
  className?: string;
}

/** Account & prep — lead details plus pre-call research and brief context. */
export function PostDcAccountPrepColumn({
  widgetProps,
  brief,
  className,
}: PostDcAccountPrepColumnProps) {
  const { review, call, callId, accountSnapshot } = widgetProps;
  const hasLeadDetails =
    (accountSnapshot?.length ?? 0) > 0 ||
    Boolean(call.annualRevenue || call.employeeCount || call.icpBucket);
  const hasPrepContent =
    Boolean(brief?.aiSummary) ||
    (review.researchSections?.length ?? 0) > 0 ||
    Boolean(review.headline?.trim());

  return (
    <div className={cn("flex min-w-0 flex-col gap-8", className)}>
      {hasLeadDetails ? (
        <section className="space-y-4 min-w-0">
          <h2 className="type-kicker text-muted-foreground">
            Lead details
          </h2>
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            {(accountSnapshot?.length ?? 0) > 0 ? (
              <AccountSnapshotCard rows={accountSnapshot ?? []} />
            ) : null}
            {call.annualRevenue || call.employeeCount || call.icpBucket ? (
              <CompanyMetricsCard call={call} />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-4 min-w-0">
        <h2 className="type-kicker text-muted-foreground">
          Pre-call & discovery prep
        </h2>
        <div className="flex flex-col gap-4">
          <PostBeforeContextCard callId={callId} />
          {review.headline?.trim() ? <PostHeadlineCard headline={review.headline} /> : null}
          {brief ? <BriefAISummary brief={brief} call={call} /> : null}
          {(review.researchSections?.length ?? 0) > 0 ? (
            <PreDcResearchCard
              sections={review.researchSections ?? []}
              title="Post-DC import (all fields)"
            />
          ) : null}
          {!hasPrepContent && !hasLeadDetails ? (
            <p className="type-body text-muted-foreground">
              Account details and pre-call context appear here when lead data or a brief is available.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
