"use client";

import { briefCardShellClass } from "@/components/pre-call/brief-detail-card";
import { PostDcActionProgress } from "@/components/post-dc/post-dc-action-widgets";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";

interface PostDcActionStripProps {
  hasNextSteps: boolean;
  workflowTasksTotal: number;
  workflowTasksDone: number;
  crmTasksTotal: number;
  crmTasksDone: number;
  clientEmailReady: boolean;
  internalEmailReady: boolean;
  className?: string;
  compact?: boolean;
}

/** Slim header bar: wrap-up workflow flush against layout controls, like pre-DC BANT strip. */
export function PostDcActionStrip({
  hasNextSteps,
  workflowTasksTotal,
  workflowTasksDone,
  crmTasksTotal,
  crmTasksDone,
  clientEmailReady,
  internalEmailReady,
  className,
  compact = true,
}: PostDcActionStripProps) {
  const { isIntercom } = useThemePreview();
  const tasksTotal = workflowTasksTotal + crmTasksTotal;
  const tasksDone = workflowTasksDone + crmTasksDone;

  if (tasksTotal === 0 && !hasNextSteps && !clientEmailReady) return null;

  return (
    <div
      className={cn(
        "call-detail-urbanist",
        briefCardShellClass,
        "text-card-foreground shadow-none",
        "inline-flex w-fit max-w-full min-h-0 flex-row items-center overflow-hidden text-left",
        compact ? "gap-0 px-3 py-1.5 sm:px-4 sm:py-2" : "gap-0 px-5 py-2.5",
        isIntercom && "border-[#d1d1cd] bg-[#f7f5f3]",
        className
      )}
      aria-label="Wrap-up action workflow"
    >
      <PostDcActionProgress
        compact
        hasProposal={hasNextSteps}
        tasksTotal={tasksTotal}
        tasksDone={tasksDone}
        clientEmailReady={clientEmailReady}
        internalEmailReady={internalEmailReady}
      />
    </div>
  );
}
