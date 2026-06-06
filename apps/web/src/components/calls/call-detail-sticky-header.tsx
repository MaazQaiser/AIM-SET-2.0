"use client";

import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { PreDcBantStrip } from "@/components/calls/pre-dc-bant-strip";
import { PreDcPrepReadyAction } from "@/components/calls/pre-dc-prep-ready-action";
import { PostDcActionStrip } from "@/components/post-dc/post-dc-action-strip";
import { PostDcCloseDealAction } from "@/components/post-dc/post-dc-close-deal-action";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";
import type { BANTScore, Call } from "@/types";

interface CallDetailStickyHeaderProps {
  call: Call;
  scheduleText: string;
  bant?: BANTScore;
  showJoinCall: boolean;
  isEditingLayout: boolean;
  onToggleLayout: () => void;
  /** Pre-call brief (default) or post-call wrap-up */
  phase?: "pre-dc" | "post-dc";
  backHref?: string;
  backLabel?: string;
  leadStage?: string;
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
      <TooltipContent side="bottom" className="text-xs">
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
  bant,
  showJoinCall,
  isEditingLayout,
  onToggleLayout,
  phase = "pre-dc",
  backHref,
  backLabel,
  leadStage,
  trailingActions,
  postDcWorkflow,
}: CallDetailStickyHeaderProps) {
  const { isIntercom } = useThemePreview();
  const isLive = call.status === "live";
  const isPostDc = phase === "post-dc";
  const showPreDcActionBar = !isPostDc && (Boolean(bant) || showJoinCall);
  const showPostDcActionBar = isPostDc && Boolean(postDcWorkflow);
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
                "type-headline truncate text-foreground sm:type-display",
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
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground/90">
                  <ParticipantAvatar
                    name={call.leadName}
                    kind="external"
                    size="xs"
                    className="border border-border/60"
                  />
                  <span>
                    {call.leadName}
                    {call.leadTitle ? ` · ${call.leadTitle}` : ""}
                  </span>
                </span>
              )}
              <span>{scheduleText}</span>
              {!isIntercom && (
                <Badge variant="secondary" className="h-5 text-xs font-bold">
                  {isPostDc ? "Post-DC wrap-up" : "Pre-DC"}
                </Badge>
              )}
              {isPostDc && leadStage ? (
                <Badge variant="outline" className="h-5 text-xs capitalize">
                  {leadStage}
                </Badge>
              ) : null}
              {call.annualRevenue && !isIntercom && !isPostDc && (
                <Badge variant="outline" className="h-5 font-mono text-xs">
                  {call.annualRevenue}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {trailingActions}
          {isPostDc ? <PostDcCloseDealAction callId={call.id} /> : null}
          {!isPostDc ? <PreDcPrepReadyAction callId={call.id} /> : null}
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
          {showPreDcActionBar && (
            <PreDcBantStrip
              bant={bant}
              callId={call.id}
              showJoinCall={showJoinCall}
              isLive={isLive}
              compact
              className="mx-0 shrink-0"
            />
          )}
          <LayoutSettingsButton
            isEditingLayout={isEditingLayout}
            onToggleLayout={onToggleLayout}
          />
        </div>
      </div>
    </header>
  );
}
