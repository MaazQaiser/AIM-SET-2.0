"use client";

import { BarChart3, ListChecks } from "lucide-react";
import { PostDcExpandableCard } from "@/components/post-dc/post-dc-expandable-card";
import {
  PostDcNextStepTasks,
  PostDcTasksDetailView,
} from "@/components/post-dc/post-dc-next-step-tasks";
import { PostDcTasksProgressBar } from "@/components/post-dc/post-dc-tasks-progress-bar";
import {
  hasCallAnalyticsData,
  PostDcCallAnalyticsRail,
} from "@/components/post-dc/post-dc-call-analytics-rail";
import { PostDcCallAnalyticsContent } from "@/components/post-dc/post-dc-call-analytics-card";
import {
  buildPostDcWorkflowTasks,
  countWorkflowTasksDone,
  countWorkflowTasksTotal,
} from "@/lib/post-dc/workflow-tasks";
import type { PostDcWorkflowTaskStatus } from "@/lib/post-dc/workflow-tasks";
import { resolveLeadStage } from "@/lib/post-dc/deal-signals";
import type { PostDcWidgetProps } from "@/lib/dashboard/widget-registry";
import { briefBodyClass } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";

interface PostDcTasksColumnProps {
  widgetProps: PostDcWidgetProps;
  embedded?: boolean;
  className?: string;
}

/** Sticky right rail — workflow tasks with progress. */
export function PostDcTasksColumn({
  widgetProps,
  embedded = false,
  className,
}: PostDcTasksColumnProps) {
  const {
    review,
    emailDraft,
    jiraTicket,
    landingPage,
    workflowTaskStatus,
    onWorkflowTaskStatusChange,
    onScrollToWidget,
  } = widgetProps;

  const leadStage = widgetProps.leadStage ?? resolveLeadStage(review);
  const tasks = buildPostDcWorkflowTasks({
    review,
    leadStage,
    hasEmailDraft: Boolean(emailDraft),
    hasJiraTicket: Boolean(jiraTicket),
    landingPage: landingPage ?? null,
    statusOverrides: workflowTaskStatus ?? {},
  });
  const tasksDone = countWorkflowTasksDone(tasks);
  const tasksTotal = countWorkflowTasksTotal(tasks);

  const taskProps = {
    review,
    leadStage,
    hasEmailDraft: Boolean(emailDraft),
    hasJiraTicket: Boolean(jiraTicket),
    landingPage,
    taskStatus: workflowTaskStatus ?? {},
    onTaskStatusChange: (taskId: string, status: PostDcWorkflowTaskStatus) =>
      onWorkflowTaskStatusChange?.(taskId, status),
    onScrollToWidget,
  };

  return (
    <aside
      id="post-dc-widget-post.task_list"
      className={cn(
        "flex min-w-0 flex-col gap-4 scroll-mt-28",
        !embedded && "lg:sticky lg:top-2 lg:self-start",
        className
      )}
      aria-label="Wrap-up tasks"
    >
      <PostDcExpandableCard
        title="Tasks"
        icon={ListChecks}
        expandLabel="Expand tasks"
        enableMainScroll={false}
        className="shadow-none w-full"
        headerExtra={
          tasksTotal > 0 ? (
            <span className="type-label tabular-nums text-muted-foreground shrink-0 font-medium">
              {tasksDone}/{tasksTotal}
            </span>
          ) : null
        }
        modalContent={<PostDcTasksDetailView {...taskProps} />}
      >
        <div className={cn("flex flex-col gap-3 post-dc-body", briefBodyClass)}>
          {tasksTotal > 0 ? (
            <PostDcTasksProgressBar done={tasksDone} total={tasksTotal} compact />
          ) : null}
          <PostDcNextStepTasks
            {...taskProps}
            showRecommendation={false}
            bare
            variant="rail"
          />
        </div>
      </PostDcExpandableCard>

      {hasCallAnalyticsData(review) ? (
        <PostDcExpandableCard
          title="Call analytics"
          icon={BarChart3}
          expandLabel="Expand call analytics"
          enableMainScroll={false}
          className="shadow-none w-full"
          modalContent={<PostDcCallAnalyticsContent review={review} />}
        >
          <PostDcCallAnalyticsRail review={review} />
        </PostDcExpandableCard>
      ) : null}
    </aside>
  );
}
