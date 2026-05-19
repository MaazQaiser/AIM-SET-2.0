"use client";

import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useAgentAudit } from "@/lib/data/hooks";
import type { ColumnDef } from "@tanstack/react-table";

interface AuditRow {
  timestamp: string;
  agent: string;
  action: string;
  user: string;
  cost: string;
}

const auditColumns: ColumnDef<AuditRow>[] = [
  { accessorKey: "timestamp", header: "Timestamp" },
  { accessorKey: "agent", header: "Agent" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "user", header: "User" },
  { accessorKey: "cost", header: "AI cost" },
];

export function GovernanceAuditTable() {
  const { data: events = [], isLoading } = useAgentAudit();

  const rows: AuditRow[] = events.map((e) => ({
    timestamp: new Date(e.timestamp).toLocaleString(),
    agent: e.agent_id,
    action: e.event_type.replace(/_/g, " "),
    user: "—",
    cost: e.cost_usd != null ? `$${e.cost_usd.toFixed(4)}` : "—",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Agent audit events from the API</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading audit events…</p>
        ) : rows.length > 0 ? (
          <DataTable
            columns={auditColumns}
            data={rows}
            searchKey="agent"
            searchPlaceholder="Filter by agent..."
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No audit events"
            description="Agent operations will appear here as they are recorded."
          />
        )}
      </CardContent>
    </Card>
  );
}
