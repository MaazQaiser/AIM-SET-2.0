import { Calendar, Clock, ArrowUpRight, DollarSign } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { callDetailsHref } from "@/lib/dashboard/call-links";
import { companyStageForCall } from "@/lib/dc-notes/company-stage";
import { companyRatingForCall, formatCompanyRating } from "@/lib/dc-notes/icp-rating";
import type { Call } from "@/types";

interface CallCardProps {
  call: Call;
}

const STATUS_CONFIG = {
  upcoming:  { label: "Upcoming",  variant: "secondary"   as const, dot: "bg-muted-foreground" },
  live:      { label: "Live",      variant: "live"        as const, dot: "bg-success animate-live-pulse", pulse: true },
  completed: { label: "Post-DC",   variant: "outline"     as const, dot: "bg-success" },
  "no-show": { label: "No show",   variant: "destructive" as const, dot: "bg-destructive" },
};

export function CallCard({ call }: CallCardProps) {
  const cfg = STATUS_CONFIG[call.status];
  const scheduledDate = new Date(call.scheduledAt);
  const isLive = call.status === "live";
  const companyStage = companyStageForCall(call);
  const agentRating = formatCompanyRating(companyRatingForCall(call));

  return (
    <Card
      className={cn(
        "group transition-all",
        isLive && "ring-1 ring-primary/30 border-primary/20"
      )}
    >
      <CardContent className="p-5 space-y-4">

        {/* ── Header: name + status + link ───────────────────────────── */}
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h3 className="type-section-title truncate text-foreground">
                {call.accountName}
              </h3>
              <Badge
                variant={cfg.variant}
                pulse={"pulse" in cfg ? cfg.pulse : false}
                className="shrink-0"
              >
                {cfg.label}
              </Badge>
            </div>
            {call.status !== "no-show" && (
              <Button asChild size="icon" variant="outline" className="h-8 w-8 shrink-0">
                <Link href={callDetailsHref(call)} aria-label={`View details for ${call.accountName}`}>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {call.annualRevenue && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-300/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-100"
              >
                <DollarSign className="h-3 w-3 shrink-0" />
                {call.annualRevenue}
                <span className="font-normal opacity-80">rev</span>
              </Badge>
            )}
            <Badge
              variant="outline"
              className="gap-1 tabular-nums border-amber-300/80 bg-amber-50/80 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
            >
              Rating {agentRating}
            </Badge>
            {call.dealStage && (
              <Badge
                variant="outline"
                className={cn(
                  companyStage === "Enterprise" &&
                    "border-violet-300/80 bg-violet-50/80 text-violet-900",
                  companyStage === "Startup" && "border-sky-300/80 bg-sky-50/80 text-sky-900",
                  companyStage === "Funded Startup" &&
                    "border-indigo-300/80 bg-indigo-50/90 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-700/60",
                  companyStage === "Ideation" && "border-amber-300/80 bg-amber-50/80 text-amber-950",
                  companyStage === "SMB" &&
                    "border-teal-300/80 bg-teal-50/90 text-teal-900 dark:bg-teal-950/40 dark:text-teal-100 dark:border-teal-700/60"
                )}
              >
                {companyStage}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Meta row: lead, date, time ──────────────────────────────── */}
        <div className="space-y-2 border-t pt-3 type-body-sm text-muted-foreground">
          {call.leadName && (
            <div className="flex min-w-0 items-center gap-1.5 truncate border-b border-border/60 pb-2 font-medium text-foreground/80">
              <ParticipantAvatar name={call.leadName} kind="external" size="xs" />
              <span className="truncate">
                {call.leadName}
                {call.leadTitle && (
                  <span className="font-normal text-muted-foreground"> · {call.leadTitle}</span>
                )}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {call.discoveryCallDatePkt ?? format(scheduledDate, "EEE, MMM d, yyyy")}
              {call.discoveryCallDatePkt && (
                <span className="text-muted-foreground/70">(PKT)</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {call.discoveryCallTimePkt ?? format(scheduledDate, "h:mm a")}
              {call.discoveryCallTimePkt && (
                <span className="text-muted-foreground/70">PKT</span>
              )}
            </span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
