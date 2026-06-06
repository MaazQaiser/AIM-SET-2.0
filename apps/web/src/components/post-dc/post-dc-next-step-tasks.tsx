"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mail,
  Ticket,
} from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { BriefDetailCard, briefBodyClass } from "@/components/pre-call/brief-detail-card";
import {
  buildPostDcWorkflowTasks,
  countWorkflowTasksDone,
  getPostDcRecommendation,
  type PostDcWorkflowTask,
  type PostDcWorkflowTaskKind,
  type PostDcWorkflowTaskStatus,
} from "@/lib/post-dc/workflow-tasks";
import type { PostCallReview, PostCallTask } from "@/lib/brief-types";
import type { CustomerLandingPage } from "@dc-copilot/types";
import { cn } from "@/lib/cn";
import { TaskList } from "@/components/post-dc/crm-task-list";
import { PostDcAiNextSteps } from "@/components/post-dc/post-dc-ai-next-steps";
import { PostDcModalSection } from "@/components/post-dc/post-dc-modal-section";
import { PostDcTasksProgressBar } from "@/components/post-dc/post-dc-tasks-progress-bar";

const KIND_ICONS: Record<PostDcWorkflowTaskKind, React.ElementType> = {
  send_client_email: Mail,
  create_jira_ticket: Ticket,
  schedule_meeting: Calendar,
  create_landing_page: Globe,
  build_proposal: FileText,
};

const KIND_ICON_COLORS: Record<PostDcWorkflowTaskKind, string> = {
  send_client_email: "text-blue-600",
  create_jira_ticket: "text-indigo-600",
  schedule_meeting: "text-amber-600",
  create_landing_page: "text-emerald-600",
  build_proposal: "text-orange-600",
};

interface PostDcNextStepTasksProps {
  review: PostCallReview;
  leadStage: string;
  hasEmailDraft: boolean;
  hasJiraTicket: boolean;
  landingPage?: CustomerLandingPage | null;
  taskStatus: Record<string, PostDcWorkflowTaskStatus>;
  onTaskStatusChange: (taskId: string, status: PostDcWorkflowTaskStatus) => void;
  onScrollToWidget?: (widgetId: string) => void;
  /** Card title — Overview grid uses "Tasks" */
  title?: string;
  /** Show collapsible AI recommendation above checklist */
  showRecommendation?: boolean;
  crmTasks?: PostCallTask[];
  onApproveCrmTasks?: (ids: string[]) => void;
  onRejectCrmTask?: (id: string) => void;
  /** Render checklist only — outer card supplied by parent */
  bare?: boolean;
  /** Always show hint/detail (expand modal) */
  detailed?: boolean;
  /** Compact sidebar rail — tight rows, no inline actions */
  variant?: "default" | "rail";
}

export function PostDcNextStepTasks({
  review,
  leadStage,
  hasEmailDraft,
  hasJiraTicket,
  landingPage,
  taskStatus,
  onTaskStatusChange,
  onScrollToWidget,
  title = "Recommended next steps",
  showRecommendation = true,
  crmTasks = [],
  onApproveCrmTasks,
  onRejectCrmTask,
  bare = false,
  detailed = false,
  variant = "default",
}: PostDcNextStepTasksProps) {
  const recommendation = getPostDcRecommendation(review);
  const tasks = buildPostDcWorkflowTasks({
    review,
    leadStage,
    hasEmailDraft,
    hasJiraTicket,
    landingPage,
    statusOverrides: taskStatus,
  });

  if (tasks.length === 0 && !recommendation && crmTasks.length === 0) return null;

  const isHighlight = title === "Recommended next steps";

  const body = (
    <>
      {showRecommendation && recommendation ? (
        <div className="mb-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 text-[0.9375rem] leading-relaxed text-foreground/90">
          {recommendation}
        </div>
      ) : null}
      {tasks.length > 0 ? (
        <ul
          className={cn(
            "flex w-full min-w-0 flex-col",
            variant === "rail" ? "gap-0.5" : "divide-y divide-border/60"
          )}
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <WorkflowTaskRow
                task={task}
                onStatusChange={onTaskStatusChange}
                onScrollToWidget={onScrollToWidget}
                detailed={detailed}
                variant={variant}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {crmTasks.length > 0 ? (
        <div className={cn(tasks.length > 0 && "mt-4 border-t border-border/60 pt-3")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            CRM follow-ups
          </p>
          <TaskList
            bare
            tasks={crmTasks}
            onApprove={onApproveCrmTasks}
            onReject={onRejectCrmTask}
          />
        </div>
      ) : null}
    </>
  );

  if (bare) return body;

  return (
    <BriefDetailCard
      title={title}
      variant={isHighlight ? "highlight" : "default"}
      className="w-full h-full"
    >
      {body}
    </BriefDetailCard>
  );
}

/** Full task breakdown for expand modal. */
export function PostDcTasksDetailView({
  review,
  leadStage,
  hasEmailDraft,
  hasJiraTicket,
  landingPage,
  taskStatus,
  onTaskStatusChange,
  onScrollToWidget,
  crmTasks = [],
  onApproveCrmTasks,
  onRejectCrmTask,
}: Omit<PostDcNextStepTasksProps, "bare" | "detailed" | "title" | "showRecommendation">) {
  const recommendation = getPostDcRecommendation(review);
  const tasks = buildPostDcWorkflowTasks({
    review,
    leadStage,
    hasEmailDraft,
    hasJiraTicket,
    landingPage,
    statusOverrides: taskStatus,
  });
  const done = countWorkflowTasksDone(tasks);

  return (
    <div className="space-y-6">
      <PostDcTasksProgressBar done={done} total={tasks.length} />

      {recommendation ? (
        <PostDcModalSection
          title="AI reasoning"
          description="Why these tasks were suggested for this deal."
        >
          <PostDcAiNextSteps text={recommendation} />
        </PostDcModalSection>
      ) : null}

      {tasks.length > 0 ? (
        <PostDcModalSection title="Wrap-up checklist">
          <div className="grid gap-3 sm:grid-cols-2">
            {tasks.map((task) => (
              <WorkflowTaskDetailCard
                key={task.id}
                task={task}
                onStatusChange={onTaskStatusChange}
                onScrollToWidget={onScrollToWidget}
              />
            ))}
          </div>
        </PostDcModalSection>
      ) : null}

      {crmTasks.length > 0 ? (
        <PostDcModalSection title="CRM follow-ups">
          <TaskList
            bare
            tasks={crmTasks}
            onApprove={onApproveCrmTasks}
            onReject={onRejectCrmTask}
          />
        </PostDcModalSection>
      ) : null}
    </div>
  );
}

function WorkflowTaskDetailCard({
  task,
  onStatusChange,
  onScrollToWidget,
}: {
  task: PostDcWorkflowTask;
  onStatusChange: (taskId: string, status: PostDcWorkflowTaskStatus) => void;
  onScrollToWidget?: (widgetId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICONS[task.kind];
  const isDone = task.status === "done";
  const isSkipped = task.status === "skipped";
  const canOpen = Boolean(task.scrollTarget && onScrollToWidget && !task.actionDisabled);

  async function toggleDone() {
    if (isDone) {
      onStatusChange(task.id, "pending");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 250));
    onStatusChange(task.id, "done");
    setBusy(false);
  }

  return (
    <div className="group rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="flex items-start gap-3">
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", KIND_ICON_COLORS[task.kind])}
          aria-hidden
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold leading-snug break-words text-foreground">
              {task.title}
            </p>
            {task.badge ? (
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{task.badge}</span>
            ) : null}
            {isSkipped ? (
              <span className="mt-0.5 block text-[10px] text-muted-foreground">Skipped</span>
            ) : null}
          </div>

          {task.hint ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{task.hint}</p>
          ) : null}
          {task.detail ? (
            <p className="text-sm leading-relaxed text-foreground/80">{task.detail}</p>
          ) : null}

          {(canOpen || (!isDone && !isSkipped)) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
              {canOpen ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onScrollToWidget?.(task.scrollTarget!)}
                >
                  {task.actionLabel}
                </Button>
              ) : null}
              {!isDone && !isSkipped ? (
                <button
                  type="button"
                  onClick={() => onStatusChange(task.id, "skipped")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Skip
                </button>
              ) : null}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void toggleDone()}
          disabled={busy || isSkipped}
          className={cn(
            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            isDone
              ? "border-success bg-success text-success-foreground"
              : isSkipped
                ? "border-border/50 bg-muted/40 cursor-not-allowed"
                : "border-border bg-background hover:border-primary/50"
          )}
          aria-label={isDone ? `Mark ${task.title} as pending` : `Mark ${task.title} as done`}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : isDone ? (
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          ) : null}
        </button>
      </div>
    </div>
  );
}

function WorkflowTaskRow({
  task,
  onStatusChange,
  onScrollToWidget,
  detailed = false,
  variant = "default",
}: {
  task: PostDcWorkflowTask;
  onStatusChange: (taskId: string, status: PostDcWorkflowTaskStatus) => void;
  onScrollToWidget?: (widgetId: string) => void;
  detailed?: boolean;
  variant?: "default" | "rail";
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICONS[task.kind];
  const isDone = task.status === "done";
  const isSkipped = task.status === "skipped";
  const hasDetail = Boolean(task.hint || task.detail);
  const canOpen = Boolean(task.scrollTarget && onScrollToWidget && !task.actionDisabled);
  const showInlineDetail = detailed || expanded;
  const showActions = variant !== "rail" && (canOpen || (!isDone && !isSkipped));
  const isRail = variant === "rail";

  async function toggleDone() {
    if (isDone) {
      onStatusChange(task.id, "pending");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 250));
    onStatusChange(task.id, "done");
    setBusy(false);
  }

  function handleOpen() {
    if (canOpen && task.scrollTarget) {
      onScrollToWidget?.(task.scrollTarget);
    }
  }

  function handleRowClick() {
    if (isRail && canOpen) {
      handleOpen();
      return;
    }
    if (hasDetail) setExpanded((v) => !v);
    else handleOpen();
  }

  return (
    <div
      className={cn(
        "group",
        isRail
          ? "rounded-md px-1 py-2 hover:bg-muted/30 transition-colors"
          : "py-3 first:pt-0 last:pb-0"
      )}
    >
      <div className={cn("flex gap-2", isRail ? "items-start" : "items-start gap-2.5")}>
        <Icon
          className={cn(
            "mt-0.5 shrink-0",
            KIND_ICON_COLORS[task.kind],
            isRail ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={handleRowClick}
            disabled={isSkipped && !canOpen}
            className={cn(
              "w-full text-left",
              (hasDetail || canOpen) && "cursor-pointer"
            )}
          >
            <span
              className={cn(
                "block min-w-0 leading-snug break-words",
                isRail ? cn(briefBodyClass, "font-medium") : cn(briefBodyClass, "font-medium"),
                isDone && "text-muted-foreground line-through decoration-muted-foreground/50",
                isSkipped && "text-muted-foreground/70"
              )}
            >
              {task.title}
            </span>
            {task.badge ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                {task.badge}
              </span>
            ) : null}
          </button>

          {!isRail && showInlineDetail && hasDetail ? (
            <div className={cn("mt-1.5 space-y-1", detailed && "pl-0")}>
              {task.hint ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{task.hint}</p>
              ) : null}
              {task.detail ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{task.detail}</p>
              ) : null}
            </div>
          ) : null}

          {showActions ? (
            <div
              className={cn(
                "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1",
                "opacity-100 lg:opacity-0 lg:transition-opacity lg:duration-150",
                "lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
                detailed && "lg:opacity-100"
              )}
            >
              {canOpen ? (
                <button
                  type="button"
                  onClick={handleOpen}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {task.actionLabel}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
              {!isDone && !isSkipped ? (
                <button
                  type="button"
                  onClick={() => onStatusChange(task.id, "skipped")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Skip
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void toggleDone();
          }}
          disabled={busy || isSkipped}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            isRail ? "mt-0.5 h-4 w-4" : "mt-0.5 h-5 w-5",
            isDone
              ? "border-success bg-success text-success-foreground"
              : isSkipped
                ? "border-border/50 bg-muted/40 text-transparent cursor-not-allowed"
                : "border-border bg-background hover:border-primary/50"
          )}
          aria-label={isDone ? `Mark ${task.title} as pending` : `Mark ${task.title} as done`}
        >
          {busy ? (
            <Loader2 className={cn("animate-spin text-muted-foreground", isRail ? "h-2.5 w-2.5" : "h-3 w-3")} />
          ) : isDone ? (
            <Check className={cn(isRail ? "h-2.5 w-2.5" : "h-3 w-3")} strokeWidth={3} aria-hidden />
          ) : null}
        </button>
      </div>
    </div>
  );
}
