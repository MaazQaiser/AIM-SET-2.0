"use client";

import { useState } from "react";
import { AlertCircle, ExternalLink, Loader2, TicketCheck } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import type { PostCallJiraTicket } from "@/lib/brief-types";

interface JiraTicketCardProps {
  ticket: PostCallJiraTicket;
  onCreate?: (ticket: PostCallJiraTicket) => Promise<void> | void;
}

export function JiraTicketCard({ ticket, onCreate }: JiraTicketCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      await onCreate?.(ticket);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-insight-card overflow-hidden">
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
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
            {ticket.description}
          </p>
        </div>
        {ticket.error && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {ticket.error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Uses the configured Jira project and issue type.
        </p>
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
            Create ticket in Jira
          </Button>
        )}
      </div>
    </div>
  );
}
