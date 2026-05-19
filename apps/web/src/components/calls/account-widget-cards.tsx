"use client";

import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

export interface AccountSnapshotRow {
  label: string;
  value: string;
}

export function AccountSnapshotCard({ rows }: { rows: AccountSnapshotRow[] }) {
  const { compact, wide } = useWidgetSize();
  if (rows.length === 0) return null;
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm">Account snapshot</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-4 gap-y-2" : "space-y-2"
        )}
      >
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{row.label}</p>
            <p
              className={cn(
                "text-sm font-medium leading-snug break-words",
                compact && "text-[13px] line-clamp-2"
              )}
            >
              {row.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CompanyMetricsCard({ call }: { call: Call }) {
  const { compact, wide } = useWidgetSize();
  const hasAny = Boolean(call.annualRevenue || call.employeeCount || call.icpBucket);
  if (!hasAny) return null;
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm">Company metrics</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-3 gap-3" : "space-y-2"
        )}
      >
        {call.annualRevenue && (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Annual revenue</p>
            <p
              className={cn(
                "font-semibold text-primary break-words",
                compact ? "text-base" : "text-lg"
              )}
            >
              {call.annualRevenue}
            </p>
            {!compact &&
              call.annualRevenueRaw &&
              call.annualRevenueRaw !== call.annualRevenue && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {call.annualRevenueRaw}
                </p>
              )}
          </div>
        )}
        {call.employeeCount && (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-sm font-medium break-words">{call.employeeCount}</p>
          </div>
        )}
        {call.icpBucket && (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">ICP bucket</p>
            <p
              className={cn(
                "text-sm font-medium break-words",
                compact && "line-clamp-2"
              )}
            >
              {call.icpBucket}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
