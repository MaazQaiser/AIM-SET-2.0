"use client";

import { CheckCircle2, XCircle, AlertTriangle, Minus } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { DataTable } from "@dc-copilot/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { AgentRun, RunOutcome } from "@/types/agents";
import { cn } from "@/lib/cn";

interface AgentRunTableProps {
  runs: AgentRun[];
}

const OUTCOME_CONFIG: Record<RunOutcome, { icon: React.ElementType; label: string; className: string }> = {
  success: { icon: CheckCircle2, label: "Success", className: "text-success" },
  partial: { icon: AlertTriangle, label: "Partial", className: "text-warning" },
  failed: { icon: XCircle, label: "Failed", className: "text-destructive" },
  aborted: { icon: Minus, label: "Aborted", className: "text-muted-foreground" },
};

function fmt(ms?: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const columns: ColumnDef<AgentRun>[] = [
  {
    accessorKey: "triggered_at",
    header: "Time",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{fmtTime(row.original.triggered_at)}</span>
    ),
  },
  {
    accessorKey: "trigger",
    header: "Trigger",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs font-mono">
        {row.original.trigger}
      </Badge>
    ),
  },
  {
    accessorKey: "operation",
    header: "Operation",
    cell: ({ row }) => <span className="text-xs font-mono">{row.original.operation}</span>,
  },
  {
    accessorKey: "outcome",
    header: "Outcome",
    cell: ({ row }) => {
      const cfg = OUTCOME_CONFIG[row.original.outcome];
      const Icon = cfg.icon;
      return (
        <div className={cn("flex items-center gap-1 text-xs font-medium", cfg.className)}>
          <Icon className="h-3.5 w-3.5" />
          <span>{cfg.label}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "duration_ms",
    header: "Duration",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{fmt(row.original.duration_ms)}</span>
    ),
  },
  {
    accessorKey: "cost_usd",
    header: "Cost",
    cell: ({ row }) => (
      <span className="text-xs font-mono">${row.original.cost_usd.toFixed(4)}</span>
    ),
  },
  {
    accessorKey: "model_used",
    header: "Model",
    cell: ({ row }) => (
      <span className="text-[10px] text-muted-foreground font-mono">
        {row.original.model_used.split("-").slice(0, 3).join("-")}
      </span>
    ),
  },
];

export function AgentRunTable({ runs }: AgentRunTableProps) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No runs recorded yet
      </div>
    );
  }

  return <DataTable columns={columns} data={runs} />;
}
