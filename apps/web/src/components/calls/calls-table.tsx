"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { DataTable } from "@dc-copilot/ui/components/data-table";
import { callDetailsHref } from "@/lib/dashboard/call-links";
import { companyStageForCall } from "@/lib/dc-notes/company-stage";
import { companyRatingForCall, formatCompanyRating } from "@/lib/dc-notes/icp-rating";
import { cn } from "@/lib/cn";
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

const columns: ColumnDef<Call>[] = [
  {
    accessorKey: "accountName",
    header: "Account",
    cell: ({ row }) => {
      const call = row.original;
      return (
        <div>
          <Link
            href={callDetailsHref(call)}
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
    id: "companyStage",
    accessorFn: (row) => companyStageForCall(row),
    header: "Company Stage",
    cell: ({ row }) => {
      const stage = companyStageForCall(row.original);
      return (
        <Badge
          variant="outline"
          className={cn(
            "text-[11px] font-medium max-w-[128px] truncate",
            stage === "Enterprise" && "border-violet-300/80 bg-violet-50/80 text-violet-900",
            stage === "Startup" && "border-sky-300/80 bg-sky-50/80 text-sky-900",
            stage === "Funded Startup" &&
              "border-indigo-300/80 bg-indigo-50/90 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-700/60",
            stage === "Ideation" && "border-amber-300/80 bg-amber-50/80 text-amber-950",
            stage === "SMB" &&
              "border-teal-300/80 bg-teal-50/90 text-teal-900 dark:bg-teal-950/40 dark:text-teal-100 dark:border-teal-700/60"
          )}
        >
          {stage}
        </Badge>
      );
    },
  },
  {
    id: "agentRatingSales",
    accessorFn: (row) => companyRatingForCall(row),
    header: "Agent Rating Sales",
    cell: ({ row }) => {
      const score = companyRatingForCall(row.original);
      return (
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatCompanyRating(score)}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const call = row.original;
      if (call.status === "no-show") {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      return (
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link href={callDetailsHref(call)}>View details</Link>
        </Button>
      );
    },
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
      shellClassName="overflow-hidden rounded-none border-0 bg-transparent shadow-none"
      headerClassName="border-0 border-b-0 bg-transparent"
      tableClassName="bg-transparent"
      bodyClassName="bg-transparent"
      rowClassName="border-0 border-b-0 bg-transparent hover:bg-muted/20"
      paginationClassName="pt-2"
    />
  );
}
