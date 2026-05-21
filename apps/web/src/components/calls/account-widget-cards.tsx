"use client";

import { BriefDetailCard, BriefDetailFields } from "@/components/pre-call/brief-detail-card";
import type { Call } from "@/types";

export interface AccountSnapshotRow {
  label: string;
  value: string;
}

export function AccountSnapshotCard({ rows }: { rows: AccountSnapshotRow[] }) {
  if (rows.length === 0) return null;
  return (
    <BriefDetailCard title="Account snapshot" scrollMaxHeight="14rem">
      <BriefDetailFields rows={rows} />
    </BriefDetailCard>
  );
}

export function CompanyMetricsCard({ call }: { call: Call }) {
  const hasAny = Boolean(call.annualRevenue || call.employeeCount || call.icpBucket);
  if (!hasAny) return null;
  return (
    <BriefDetailCard title="Company metrics">
      <BriefDetailFields
        rows={[
          ...(call.annualRevenue
            ? [
                {
                  label: "Annual revenue",
                  value:
                    call.annualRevenueRaw && call.annualRevenueRaw !== call.annualRevenue
                      ? `${call.annualRevenue} (${call.annualRevenueRaw})`
                      : call.annualRevenue,
                },
              ]
            : []),
          ...(call.employeeCount ? [{ label: "Employees", value: call.employeeCount }] : []),
          ...(call.icpBucket ? [{ label: "ICP bucket", value: call.icpBucket }] : []),
        ]}
      />
    </BriefDetailCard>
  );
}
