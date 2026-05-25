"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, TicketCheck } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import type { PostCallJiraTicket } from "@/lib/brief-types";

interface JiraTicketCardProps {
  ticket: PostCallJiraTicket;
  onCreate?: (ticket: PostCallJiraTicket) => Promise<void> | void;
}

export function JiraTicketCard({ ticket, onCreate }: JiraTicketCardProps) {
  const [loading, setLoading] = useState(false);
  const bantRows = [
    ["budget", "Budget"],
    ["authority", "Authority"],
    ["need", "Need"],
    ["timeline", "Timeline"],
  ] as const;

  async function handleCreate() {
    setLoading(true);
    try {
      await onCreate?.(ticket);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <TicketCheck className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate text-sm font-medium">Jira ticket draft</span>
        </div>
        <Badge variant={ticket.status === "created" ? "success" : ticket.status === "failed" ? "destructive" : "secondary"}>
          {ticket.status === "created" ? "Created" : ticket.status === "failed" ? "Failed" : "Draft"}
        </Badge>
      </div>
      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-foreground">{ticket.summary}</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
            {ticket.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {ticket.projectKey}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {ticket.issueType}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {ticket.priority}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {bantRows.map(([key, label]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/5 px-2 py-1 text-[10px] font-medium text-success"
            >
              <CheckCircle2 className="h-3 w-3" />
              {label} confirmed
            </span>
          ))}
        </div>
        {ticket.error && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {ticket.error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">Created only after approval.</p>
        {ticket.status === "created" && ticket.externalUrl ? (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <a href={ticket.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open
            </a>
          </Button>
        ) : (
          <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={handleCreate}>
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TicketCheck className="mr-1.5 h-3.5 w-3.5" />}
            Create ticket on Jira
          </Button>
        )}
      </div>
    </div>
  );
}
