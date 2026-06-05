import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import type { Call } from "@/types";
import type { PreDCRecord } from "@/types/dc-notes";
import { preDcField } from "@/types/dc-notes";

const PLACEHOLDER_ROWS: AccountSnapshotRow[] = [
  { label: "Account context", value: "Import Pre-DC CSV for full account context" },
];

function snapshotRow(
  label: string,
  value: string | undefined | null
): AccountSnapshotRow | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? { label, value: trimmed } : null;
}

function annualRevenueRow(call: Call): AccountSnapshotRow | null {
  if (!call.annualRevenue) return null;
  const value =
    call.annualRevenueRaw && call.annualRevenueRaw !== call.annualRevenue
      ? `${call.annualRevenue} (${call.annualRevenueRaw})`
      : call.annualRevenue;
  return { label: "Annual revenue", value };
}

export function buildAccountSnapshot({
  preRecord,
  call,
  includePlaceholder = false,
}: {
  preRecord?: PreDCRecord | null;
  call?: Call | null;
  includePlaceholder?: boolean;
}): AccountSnapshotRow[] {
  const rows: AccountSnapshotRow[] = [];
  const seenLabels = new Set<string>();

  const add = (label: string, value: string | undefined | null) => {
    if (seenLabels.has(label)) return;
    const row = snapshotRow(label, value);
    if (!row) return;
    seenLabels.add(label);
    rows.push(row);
  };

  if (preRecord) {
    add("Industry", preDcField(preRecord, "industry"));
    add("Employees", preDcField(preRecord, "employeeCount"));
    add("Revenue", preDcField(preRecord, "annualRevenue"));
    add("ICP bucket", preDcField(preRecord, "icpBucket"));
    add("Website", preDcField(preRecord, "website"));
    add("Tech stacks", preDcField(preRecord, "techStacks"));
  }

  if (call) {
    if (!seenLabels.has("Industry")) add("Industry", call.industry);
    const revenue = annualRevenueRow(call);
    if (revenue && !seenLabels.has("Revenue") && !seenLabels.has("Annual revenue")) {
      seenLabels.add("Annual revenue");
      rows.push(revenue);
    }
    if (!seenLabels.has("Employees")) add("Employees", call.employeeCount);
    if (!seenLabels.has("ICP bucket")) add("ICP bucket", call.icpBucket);
    add("Deal stage", call.dealStage ?? "Discovery");
  }

  if (rows.length === 0 && includePlaceholder) return PLACEHOLDER_ROWS;
  return rows;
}
