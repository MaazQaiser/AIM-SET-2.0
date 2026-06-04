"use client";

import { useState } from "react";
import { AlertCircle, ExternalLink, Loader2, TicketCheck } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import type { PostCallJiraTicket } from "@/lib/brief-types";

interface JiraTicketCardProps {
  ticket: PostCallJiraTicket;
  onCreate?: (ticket: PostCallJiraTicket) => Promise<void> | void;
}

const BANT_LABELS = [
  { key: "budget", label: "Budget" },
  { key: "authority", label: "Authority" },
  { key: "need", label: "Need" },
  { key: "timeline", label: "Timeline" },
] as const;

export function JiraTicketCard({ ticket, onCreate }: JiraTicketCardProps) {
  const [loading, setLoading] = useState(false);
  const allBantConfirmed = BANT_LABELS.every(({ key }) => ticket.bantSnapshot[key]);

  async function handleCreate() {
    setLoading(true);
    try {
      await onCreate?.(ticket);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BriefDetailCard title="Jira ticket draft" icon={TicketCheck} className="w-full">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ticket.status === "created" ? "success" : ticket.status === "failed" ? "destructive" : "secondary"}>
            {ticket.status === "created" ? "Created" : ticket.status === "failed" ? "Failed" : "Draft"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {ticket.priority} priority
          </Badge>
          {!allBantConfirmed ? (
            <Badge variant="warning" className="text-[10px]">
              BANT review needed
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              BANT qualified
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {BANT_LABELS.map(({ key, label }) => (
            <span
              key={key}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                ticket.bantSnapshot[key]
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{ticket.summary}</p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {ticket.description}
          </p>
        </div>

        {ticket.error ? (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {ticket.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Project {ticket.projectKey} · {ticket.issueType}
            {!allBantConfirmed ? " · Review draft before creating in Jira." : ""}
          </p>
          {ticket.status === "created" && ticket.externalUrl ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <a href={ticket.externalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open in Jira
              </a>
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={handleCreate}>
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <TicketCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              Create ticket in Jira
            </Button>
          )}
        </div>
      </div>
    </BriefDetailCard>
  );
}
