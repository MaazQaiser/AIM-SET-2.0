"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { DataTable } from "@dc-copilot/ui/components/data-table";
import type { Call, CallStatus } from "@/types";

const STATUS_CONFIG: Record<
  CallStatus,
  { label: string; variant: "secondary" | "live" | "outline" | "destructive"; pulse?: boolean }
> = {
  upcoming: { label: "Upcoming", variant: "secondary" },
  live: { label: "Live", variant: "live", pulse: true },
  completed: { label: "Completed", variant: "outline" },
  "no-show": { label: "No show", variant: "destructive" },
};

function primaryAction(call: Call) {
  if (call.status === "live") {
    return (
      <Button asChild size="sm" variant="default" className="h-8">
        <Link href={`/calls/${call.id}/live`}>Join live</Link>
      </Button>
    );
  }
  if (call.status === "upcoming") {
    return call.briefReady ? (
      <Button asChild size="sm" variant="default" className="h-8">
        <Link href={`/calls/${call.id}`}>Open brief</Link>
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">Generating…</span>
    );
  }
  if (call.status === "completed") {
    return (
      <Button asChild size="sm" variant="outline" className="h-8">
        <Link href={`/calls/${call.id}/post-dc?wrapped=1`}>Summary</Link>
      </Button>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

const columns: ColumnDef<Call>[] = [
  {
    accessorKey: "accountName",
    header: "Account",
    cell: ({ row }) => {
      const call = row.original;
      return (
        <div>
          <Link
            href={`/calls/${call.id}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {call.accountName}
          </Link>
          {call.leadName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {call.leadName}
              {call.leadTitle ? ` · ${call.leadTitle}` : ""}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const cfg = STATUS_CONFIG[row.original.status];
      return (
        <Badge variant={cfg.variant} pulse={cfg.pulse}>
          {cfg.label}
        </Badge>
      );
    },
  },
  {
    id: "discoveryDate",
    accessorFn: (row) => row.discoveryCallDatePkt ?? format(new Date(row.scheduledAt), "yyyy-MM-dd"),
    header: "Discovery date",
    cell: ({ row }) => {
      const call = row.original;
      const scheduled = new Date(call.scheduledAt);
      return (
        <span className="whitespace-nowrap text-sm">
          {call.discoveryCallDatePkt ?? format(scheduled, "MMM d, yyyy")}
          {call.discoveryCallDatePkt && (
            <span className="text-muted-foreground ml-1">PKT</span>
          )}
        </span>
      );
    },
  },
  {
    id: "discoveryTime",
    accessorFn: (row) => row.discoveryCallTimePkt ?? format(new Date(row.scheduledAt), "HH:mm"),
    header: "Time",
    cell: ({ row }) => {
      const call = row.original;
      const scheduled = new Date(call.scheduledAt);
      return (
        <span className="whitespace-nowrap text-sm">
          {call.discoveryCallTimePkt ?? format(scheduled, "h:mm a")}
        </span>
      );
    },
  },
  {
    accessorKey: "industry",
    header: "Industry",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground max-w-[120px] truncate block">
        {row.original.industry ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "dealStage",
    header: "Stage",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground max-w-[100px] truncate block">
        {row.original.dealStage ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "briefReady",
    header: "Brief",
    cell: ({ row }) =>
      row.original.briefReady ? (
        <span className="text-xs font-medium text-success">Ready</span>
      ) : (
        <span className="text-xs text-muted-foreground">Pending</span>
      ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-2">
        {primaryAction(row.original)}
        <Button asChild size="sm" variant="ghost" className="h-8 text-muted-foreground">
          <Link href={`/calls/${row.original.id}`}>Details</Link>
        </Button>
      </div>
    ),
  },
];

interface CallsTableProps {
  calls: Call[];
}

export function CallsTable({ calls }: CallsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={calls}
      pageSize={10}
      shellClassName="rounded-none border-x-0 border-t-0 bg-transparent"
      headerClassName="bg-transparent"
      tableClassName="bg-transparent"
      bodyClassName="bg-transparent"
      rowClassName="bg-transparent"
      paginationClassName="pt-2"
    />
  );
}
