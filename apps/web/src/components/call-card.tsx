import { Calendar, Clock, Users, FileText, Radio, Building2, Briefcase, ChevronRight, DollarSign } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PodMemberBadge } from "./pod-member-badge";
import { BANTScorecard } from "./bant-scorecard";
import type { Call } from "@/types";

interface CallCardProps {
  call: Call;
}

const STATUS_CONFIG = {
  upcoming:  { label: "Upcoming",  variant: "secondary"   as const, dot: "bg-muted-foreground" },
  live:      { label: "Live",      variant: "live"        as const, dot: "bg-success animate-live-pulse", pulse: true },
  completed: { label: "Completed", variant: "outline"     as const, dot: "bg-success" },
  "no-show": { label: "No show",   variant: "destructive" as const, dot: "bg-destructive" },
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm uppercase select-none">
      {letters.toUpperCase()}
    </div>
  );
}

export function CallCard({ call }: CallCardProps) {
  const cfg = STATUS_CONFIG[call.status];
  const scheduledDate = new Date(call.scheduledAt);
  const isLive = call.status === "live";
  const isUpcoming = call.status === "upcoming";
  const isCompleted = call.status === "completed";

  return (
    <Card
      className={cn(
        "group transition-all hover:shadow-md",
        isLive && "ring-1 ring-primary/30 border-primary/20"
      )}
    >
      <CardContent className="p-5 space-y-4">

        {/* ── Header: avatar + name + status ─────────────────────────── */}
        <div className="flex items-start gap-3">
          <Initials name={call.accountName} />

          <div className="flex-1 min-w-0">
            {/* Company name — bold and prominent */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground leading-tight truncate">
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

            {/* Lead name — secondary, slightly smaller */}
            {call.leadName && (
              <p className="text-sm font-semibold text-foreground/80 mt-0.5 truncate">
                {call.leadName}
                {call.leadTitle && (
                  <span className="font-normal text-muted-foreground"> · {call.leadTitle}</span>
                )}
              </p>
            )}

            {/* Industry / deal stage tags */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {call.annualRevenue && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/90">
                  <DollarSign className="h-3 w-3 text-primary" />
                  {call.annualRevenue}
                  <span className="font-normal text-muted-foreground">rev</span>
                </span>
              )}
              {call.industry && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {call.industry}
                </span>
              )}
              {call.dealStage && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  {call.dealStage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Meta row: date, time, pod size ──────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
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
          {call.employeeCount && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {call.employeeCount} employees
            </span>
          )}
        </div>

        {/* ── Pod members ──────────────────────────────────────────────── */}
        {call.pod?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {call.pod.map((member) => (
              <PodMemberBadge key={member.id} member={member} />
            ))}
          </div>
        )}

        {/* ── BANT mini-scorecard (only when available) ────────────────── */}
        {call.bant && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <BANTScorecard bant={call.bant} compact />
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-t pt-3">
          {isUpcoming && (
            <>
              {call.briefReady ? (
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={`/calls/${call.id}`}>
                    <FileText className="h-3.5 w-3.5" />
                    Open brief
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled className="gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  Generating brief…
                </Button>
              )}
              <Button asChild size="sm" variant="ghost" className="ml-auto text-muted-foreground gap-1">
                <Link href={`/calls/${call.id}`}>
                  Details
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}

          {isLive && (
            <>
              <Button asChild size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-white">
                <Link href={`/calls/${call.id}/live`}>
                  <Radio className="h-3.5 w-3.5" />
                  Join live
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={`/calls/${call.id}`}>
                  <FileText className="h-3.5 w-3.5" />
                  Brief
                </Link>
              </Button>
            </>
          )}

          {isCompleted && (
            <>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={`/calls/${call.id}`}>
                  View summary
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="ml-auto text-muted-foreground gap-1 text-xs">
                <Link href={`/calls/${call.id}`}>Post-DC review</Link>
              </Button>
            </>
          )}

          {call.status === "no-show" && (
            <span className="text-xs text-muted-foreground italic">No action required</span>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
