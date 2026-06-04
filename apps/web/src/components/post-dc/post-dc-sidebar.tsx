"use client";

import {
  AccountSnapshotCard,
  CompanyMetricsCard,
  type AccountSnapshotRow,
} from "@/components/calls/account-widget-cards";
import type { Call } from "@/types";
import { cn } from "@/lib/cn";

interface PostDcSidebarProps {
  accountSnapshot: AccountSnapshotRow[];
  call: Call;
  className?: string;
}

export function PostDcSidebar({ accountSnapshot, call, className }: PostDcSidebarProps) {
  const showMetrics = Boolean(call.annualRevenue || call.employeeCount || call.icpBucket);

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col gap-4 lg:sticky lg:top-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
        className
      )}
      aria-label="Post-DC account context"
    >
      {accountSnapshot.length > 0 && <AccountSnapshotCard rows={accountSnapshot} />}
      {showMetrics && <CompanyMetricsCard call={call} />}
    </aside>
  );
}
