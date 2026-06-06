"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";

type TaskStatus = "pending_approval" | "approved" | "created" | "failed";
type TaskType = "follow_up" | "internal_review" | "content_request" | "schedule_next_meeting";

export interface TaskItem {
  id: string;
  task_type: TaskType;
  owner: string;
  due_date: string;
  description: string;
  status: TaskStatus;
  isInternalAuto?: boolean;
  crm_system?: "hubspot" | "salesforce";
}

interface TaskListProps {
  tasks: TaskItem[];
  onApprove?: (ids: string[]) => void;
  onReject?: (id: string) => void;
  /** Render list only — no outer card (nested inside Tasks panel) */
  bare?: boolean;
  title?: string;
}

const TYPE_LABELS: Record<TaskType, string> = {
  follow_up: "Follow-up",
  internal_review: "Internal review",
  content_request: "Content request",
  schedule_next_meeting: "Schedule next meeting",
};

export function TaskList({ tasks, onApprove, onReject, bare = false, title = "Task list" }: TaskListProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function handleCompleteTask(id: string) {
    setCompletingId(id);
    await new Promise((r) => setTimeout(r, 800));
    onApprove?.([id]);
    setCompletingId(null);
  }

  const body = (
    <div className="flex w-full min-w-0 flex-col divide-y divide-border/60">
      {tasks.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">No CRM tasks generated</div>
      )}

      {tasks.map((task) => {
        const isPending = task.status === "pending_approval";
        const isDone = task.status === "created";
        const isCompleting = completingId === task.id;

        return (
          <div key={task.id} className="group py-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled={!isPending || !onApprove || isCompleting}
                onClick={() => void handleCompleteTask(task.id)}
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                  isDone
                    ? "border-success bg-success text-success-foreground"
                    : isPending
                      ? "border-border bg-background hover:border-primary/50"
                      : "border-border/50 bg-muted/40 cursor-default"
                )}
                aria-label={isDone ? `${task.description} completed` : `Complete ${task.description}`}
              >
                {isCompleting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isDone ? (
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                ) : null}
              </button>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold text-foreground">
                      {TYPE_LABELS[task.task_type]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">→ {task.owner}</span>
                    {task.isInternalAuto ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Auto · internal
                      </Badge>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "text-xs leading-relaxed text-muted-foreground break-words",
                      isDone && "line-through decoration-muted-foreground/50"
                    )}
                  >
                    {task.description}
                  </p>
                </div>

                {isPending && onReject ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1",
                      "opacity-100 lg:opacity-0 lg:transition-opacity lg:duration-150",
                      "lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onReject(task.id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Skip
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (bare) return body;

  return (
    <BriefDetailCard title={title} className="w-full">
      {body}
    </BriefDetailCard>
  );
}

export type CrmTask = TaskItem;
export { TaskList as CrmTaskList };
