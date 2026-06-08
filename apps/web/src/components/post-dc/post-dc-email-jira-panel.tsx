"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { GmailIcon, JiraIcon } from "@/components/icons/brand-icons";
import { EmailEditor } from "@/components/post-dc/email-editor";
import { EmailDraftPreview } from "@/components/post-dc/email-draft-preview";
import { JiraTicketCard } from "@/components/post-dc/jira-ticket-card";
import { PostDcExpandableCard } from "@/components/post-dc/post-dc-expandable-card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatJiraTicketForCopy } from "@/lib/post-dc/format-jira-ticket-copy";
import type { PostCallEmailDraft, PostCallJiraTicket } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

type EmailAudience = "client" | "internal";

interface PostDcEmailJiraPanelProps {
  emailDraft?: PostCallEmailDraft | null;
  internalEmailDraft?: PostCallEmailDraft | null;
  jiraTicket?: PostCallJiraTicket | null;
  onCreateJiraTicket?: (ticket: PostCallJiraTicket) => Promise<void> | void;
  /** Always render email and Jira as two parallel cards */
  parallelCards?: boolean;
}

function EmailAudienceToggle({
  value,
  onChange,
  hasClient,
  hasInternal,
}: {
  value: EmailAudience;
  onChange: (v: EmailAudience) => void;
  hasClient: boolean;
  hasInternal: boolean;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
      role="tablist"
      aria-label="Email audience"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "client"}
        disabled={!hasClient}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2.5 py-1 type-caption font-medium transition-colors",
          value === "client"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          !hasClient && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => onChange("client")}
      >
        Client
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "internal"}
        disabled={!hasInternal}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2.5 py-1 type-caption font-medium transition-colors",
          value === "internal"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          !hasInternal && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => onChange("internal")}
      >
        Internal
      </button>
    </div>
  );
}

function JiraPlaceholder() {
  return (
    <p className="type-body text-muted-foreground py-6 text-center px-2">
      No Jira handoff for this lead stage — focus on client email and CRM tasks.
    </p>
  );
}

function JiraStatusBadge({ ticket }: { ticket: PostCallJiraTicket }) {
  const variant =
    ticket.status === "created" ? "success" : ticket.status === "failed" ? "destructive" : "secondary";
  const label = ticket.status === "created" ? "Created" : ticket.status === "failed" ? "Failed" : "Draft";

  return (
    <Badge variant={variant} className="shrink-0 type-caption">
      {label}
    </Badge>
  );
}

function JiraPreview({ ticket }: { ticket: PostCallJiraTicket }) {
  const [copied, setCopied] = useState(false);
  const isCreated = ticket.status === "created" && Boolean(ticket.externalUrl);

  async function handleCopy() {
    const ok = await copyTextToClipboard(formatJiraTicketForCopy(ticket));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 rounded-md border p-3 type-body",
        ticket.status === "created"
          ? "border-success/25 bg-success/5"
          : ticket.status === "failed"
            ? "border-destructive/25 bg-destructive/5"
            : "border-border/60 bg-background"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <JiraStatusBadge ticket={ticket} />
          {ticket.externalKey ? (
            <span className="type-caption font-medium text-muted-foreground">{ticket.externalKey}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isCreated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 type-caption"
                >
                  <a href={ticket.externalUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Jira
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open ticket in Jira</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 type-caption text-muted-foreground"
                onClick={() => void handleCopy()}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy ticket"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy ticket text</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <p className="type-label text-foreground break-words">{ticket.summary}</p>
      <p className="type-kicker text-muted-foreground">
        {ticket.issueType} · {ticket.priority}
      </p>
      {ticket.error ? (
        <p className="type-caption text-destructive">{ticket.error}</p>
      ) : null}
      <p className="type-caption text-muted-foreground whitespace-pre-wrap break-words line-clamp-[12]">
        {ticket.description}
      </p>
    </div>
  );
}

/** Side-by-side email (client / internal tabs inside card) and Jira ticket handoff. */
export function PostDcEmailJiraPanel({
  emailDraft,
  internalEmailDraft,
  jiraTicket,
  onCreateJiraTicket,
  parallelCards = false,
}: PostDcEmailJiraPanelProps) {
  const hasClient = Boolean(emailDraft);
  const hasInternal = Boolean(internalEmailDraft);
  const [audience, setAudience] = useState<EmailAudience>(
    hasClient ? "client" : hasInternal ? "internal" : "client"
  );

  const activeDraft = audience === "client" ? emailDraft : internalEmailDraft;
  const emailTitle = audience === "client" ? "Client follow-up" : "Internal team";
  const emailDescription =
    audience === "client"
      ? "Suggested follow-up — review To, subject, and body before sending."
      : "Suggested internal handoff for the pod.";

  if (!parallelCards && !hasClient && !hasInternal && !jiraTicket) return null;

  const emailCard = (
    <PostDcExpandableCard
      title="Email"
      headerIcon={<GmailIcon className="h-4 w-4 shrink-0" />}
      className="h-full min-h-[14rem]"
      expandLabel="Expand email draft"
      headerExtra={
        <EmailAudienceToggle
          value={audience}
          onChange={setAudience}
          hasClient={hasClient}
          hasInternal={hasInternal}
        />
      }
      modalContent={
        activeDraft ? (
          <EmailEditor draft={activeDraft} title={emailTitle} description={emailDescription} />
        ) : (
          <p className="type-body text-muted-foreground">
            {audience === "client"
              ? "Client follow-up draft will appear here after wrap-up."
              : "Internal handoff draft will appear here after wrap-up."}
          </p>
        )
      }
    >
      {activeDraft ? (
        <EmailDraftPreview draft={activeDraft} />
      ) : (
        <p className="type-body text-muted-foreground py-4 text-center">
          {audience === "client"
            ? "Client follow-up draft will appear here after wrap-up."
            : "Internal handoff draft will appear here after wrap-up."}
        </p>
      )}
    </PostDcExpandableCard>
  );

  const jiraCard = (
    <PostDcExpandableCard
      title="Jira ticket"
      headerIcon={<JiraIcon className="h-4 w-4 shrink-0" />}
      className={cn(
        "h-full min-h-[14rem]",
        jiraTicket?.status === "created" && "border-success/30",
        jiraTicket?.status === "failed" && "border-destructive/30"
      )}
      expandLabel="Expand Jira ticket"
      headerExtra={jiraTicket ? <JiraStatusBadge ticket={jiraTicket} /> : undefined}
      modalContent={
        jiraTicket ? (
          <JiraTicketCard ticket={jiraTicket} onCreate={onCreateJiraTicket} />
        ) : (
          <JiraPlaceholder />
        )
      }
    >
      {jiraTicket ? <JiraPreview ticket={jiraTicket} /> : <JiraPlaceholder />}
    </PostDcExpandableCard>
  );

  if (parallelCards) {
    return (
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="min-w-0 h-full flex flex-col">{emailCard}</div>
        <div className="min-w-0 h-full flex flex-col">{jiraCard}</div>
      </div>
    );
  }

  if (!jiraTicket) {
    return <div className="w-full min-w-0">{emailCard}</div>;
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
      <div className="min-w-0 h-full flex flex-col">{emailCard}</div>
      <div className="min-w-0 h-full flex flex-col">{jiraCard}</div>
    </div>
  );
}
