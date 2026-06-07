"use client";

import { AccountSnapshotCard, CompanyMetricsCard } from "@/components/calls/account-widget-cards";
import type { PostDcWidgetProps } from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";

interface PostDcLeadOverviewColumnProps {
  widgetProps: PostDcWidgetProps;
  className?: string;
}

/** Lead Overview tab — account snapshot and company metrics. */
export function PostDcLeadOverviewColumn({ widgetProps, className }: PostDcLeadOverviewColumnProps) {
  const { call, accountSnapshot } = widgetProps;
  const hasLeadDetails =
    (accountSnapshot?.length ?? 0) > 0 ||
    Boolean(call.annualRevenue || call.employeeCount || call.icpBucket);

  if (!hasLeadDetails) {
    return (
      <p className={cn("type-body text-muted-foreground", className)}>
        Lead details appear here when account snapshot or company metrics are available.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 md:items-start min-w-0", className)}>
      {(accountSnapshot?.length ?? 0) > 0 ? (
        <AccountSnapshotCard rows={accountSnapshot ?? []} />
      ) : null}
      {call.annualRevenue || call.employeeCount || call.icpBucket ? (
        <CompanyMetricsCard call={call} />
      ) : null}
    </div>
  );
}
