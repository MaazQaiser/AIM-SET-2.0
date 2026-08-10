"use client";

import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { CallQuickDetailsDialog } from "@/components/calls/call-quick-details-dialog";
import { PreDcPrepReadyAction } from "@/components/calls/pre-dc-prep-ready-action";
import { PostDcActionStrip } from "@/components/post-dc/post-dc-action-strip";
import { PostDcCloseDealAction } from "@/components/post-dc/post-dc-close-deal-action";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

interface CallDetailStickyHeaderProps {
  call: Call;
  scheduleText: string;
  showJoinCall: boolean;
  isEditingLayout: boolean;
  onToggleLayout: () => void;
  /** Pre-call brief (default) or post-call wrap-up */
  phase?: "pre-dc" | "post-dc";
  backHref?: string;
  backLabel?: string;
  leadStage?: string;
  personLinkedInUrl?: string;
  companyLinkedInUrl?: string;
  trailingActions?: React.ReactNode;
  postDcWorkflow?: {
    hasNextSteps: boolean;
    workflowTasksTotal: number;
    workflowTasksDone: number;
    crmTasksTotal: number;
    crmTasksDone: number;
    clientEmailReady: boolean;
    internalEmailReady: boolean;
  };
}

function HeaderIconTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="type-label">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function LayoutSettingsButton({
  isEditingLayout,
  onToggleLayout,
}: {
  isEditingLayout: boolean;
  onToggleLayout: () => void;
}) {
  const { isIntercom } = useThemePreview();
  const label = isEditingLayout ? "Done customizing layout" : "Layout settings";

  return (
    <HeaderIconTooltip label={label}>
      <Button
        type="button"
        variant={isEditingLayout ? (isIntercom ? "ghost" : "default") : "ghost"}
        size="icon"
        className={cn("h-9 w-9 shrink-0", isIntercom && "text-[#111111]")}
        onClick={onToggleLayout}
        aria-label={label}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </HeaderIconTooltip>
  );
}

function BackLinkButton({ href, label }: { href: string; label: string }) {
  const { isIntercom } = useThemePreview();

  return (
    <HeaderIconTooltip label={label}>
      <Button
        asChild
        variant="outline"
        size="icon"
        className={cn(
          "h-9 w-9 shrink-0 border-slate-300 bg-background shadow-none",
          "hover:border-slate-400 hover:bg-slate-50",
          isIntercom && "border-[#d1d1cd] bg-[#f7f5f3] hover:bg-[#ebe7e1] hover:border-[#b8b8b4]"
        )}
      >
        <Link href={href} aria-label={label}>
          <ArrowLeft
            className={cn(
              "h-4 w-4 text-slate-600",
              isIntercom && "text-[#626260]"
            )}
            strokeWidth={1.75}
          />
        </Link>
      </Button>
    </HeaderIconTooltip>
  );
}

function BackToCallsButton() {
  return <BackLinkButton href="/calls" label="Back to calls" />;
}

export function CallDetailStickyHeader({
  call,
  scheduleText,
  showJoinCall,
  isEditingLayout,
  onToggleLayout,
  phase = "pre-dc",
  backHref,
  backLabel,
  leadStage,
  personLinkedInUrl,
  companyLinkedInUrl,
  trailingActions,
  postDcWorkflow,
}: CallDetailStickyHeaderProps) {
  const { isIntercom } = useThemePreview();
  const isLive = call.status === "live";
  const isPostDc = phase === "post-dc";
  const showPreDcPrepAction = !isPostDc && showJoinCall;
  const showPostDcActionBar = isPostDc && Boolean(postDcWorkflow);
  const joinLabel = isLive ? "Join live" : "Join call";
  const resolvedBackHref = backHref ?? (isPostDc ? `/calls/${call.id}` : "/calls");
  const resolvedBackLabel =
    backLabel ?? (isPostDc ? "Back to call brief" : "Back to calls");

  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-6 border-b border-border/50 bg-background/90 px-6 pb-5 pt-2 backdrop-blur-md sm:-mx-8 sm:px-8",
        isIntercom && "border-[#e8e6e3] bg-[#f7f5f3]/95"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {isPostDc ? (
            <BackLinkButton href={resolvedBackHref} label={resolvedBackLabel} />
          ) : (
            <BackToCallsButton />
          )}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "truncate type-page-title text-foreground",
                isIntercom && "text-[#111111]"
              )}
            >
              {call.accountName}
            </h1>
            <div
              className={cn(
                "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-body-sm",
                isIntercom ? "text-[#626260]" : "text-muted-foreground"
              )}
            >
              {call.leadName && (
                <CallQuickDetailsDialog
                  call={call}
                  personLinkedInUrl={personLinkedInUrl}
                  companyLinkedInUrl={companyLinkedInUrl}
                >
                  <button
                    type="button"
                    className="group/lead inline-flex max-w-full items-center gap-1.5 rounded-md text-left font-medium text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`View client details for ${call.leadName}`}
                  >
                    <ParticipantAvatar
                      name={call.leadName}
                      kind="external"
                      size="xs"
                      className="shrink-0 border border-border/60"
                    />
                    <span className="truncate transition-colors group-hover/lead:text-primary">
                      {call.leadName}
                      {call.leadTitle ? ` · ${call.leadTitle}` : ""}
                    </span>
                  </button>
                </CallQuickDetailsDialog>
              )}
              <span>{scheduleText}</span>
              {!isIntercom && (
                <Badge variant="secondary" className="h-5">
                  {isPostDc ? "Post-DC wrap-up" : "Pre-DC"}
                </Badge>
              )}
              {isPostDc && leadStage ? (
                <Badge variant="outline" className="h-5 capitalize">
                  {leadStage}
                </Badge>
              ) : null}
              {call.annualRevenue && !isIntercom && !isPostDc && (
                <Badge variant="outline" className="h-5 font-mono">
                  {call.annualRevenue}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {trailingActions}
          {isPostDc ? <PostDcCloseDealAction callId={call.id} /> : null}
          {showPreDcPrepAction ? <PreDcPrepReadyAction callId={call.id} /> : null}
          {!isPostDc && showJoinCall ? (
            <Button
              asChild
              size="sm"
              className={cn(
                "h-8 shrink-0 rounded-full px-4 type-body font-bold",
                isIntercom && "bg-[#111111] text-white hover:bg-[#111111]/90"
              )}
            >
              <Link href={`/calls/${call.id}/live`}>{joinLabel}</Link>
            </Button>
          ) : null}
          {showPostDcActionBar && postDcWorkflow ? (
            <PostDcActionStrip
              hasNextSteps={postDcWorkflow.hasNextSteps}
              workflowTasksTotal={postDcWorkflow.workflowTasksTotal}
              workflowTasksDone={postDcWorkflow.workflowTasksDone}
              crmTasksTotal={postDcWorkflow.crmTasksTotal}
              crmTasksDone={postDcWorkflow.crmTasksDone}
              clientEmailReady={postDcWorkflow.clientEmailReady}
              internalEmailReady={postDcWorkflow.internalEmailReady}
              compact
              className="mx-0 shrink-0"
            />
          ) : null}
          <LayoutSettingsButton
            isEditingLayout={isEditingLayout}
            onToggleLayout={onToggleLayout}
          />
        </div>
      </div>
    </header>
  );
}
