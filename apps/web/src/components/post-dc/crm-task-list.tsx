"use client";

import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
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
}

const TYPE_LABELS: Record<TaskType, string> = {
  follow_up: "Follow-up",
  internal_review: "Internal review",
  content_request: "Content request",
  schedule_next_meeting: "Schedule next meeting",
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending_approval: { label: "Pending",  className: "text-warning border-warning/30 bg-warning/10",     icon: Clock },
  approved:         { label: "Approved", className: "text-primary border-primary/30 bg-primary/10",      icon: Check },
  created:          { label: "Done",     className: "text-success border-success/30 bg-success/10",      icon: CheckCircle2 },
  failed:           { label: "Failed",   className: "text-destructive border-destructive/30 bg-destructive/10", icon: AlertCircle },
};

export function TaskList({ tasks, onApprove, onReject }: TaskListProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function handleCompleteTask(id: string) {
    setCompletingId(id);
    await new Promise((r) => setTimeout(r, 800));
    onApprove?.([id]);
    setCompletingId(null);
  }

  return (
    <BriefDetailCard title="Task list" className="w-full">
      <div className="flex w-full min-w-0 flex-col divide-y divide-border">
        {tasks.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No tasks generated</div>
        )}

        {tasks.map((task) => {
          const cfg = STATUS_CONFIG[task.status];
          const Icon = cfg.icon;
          const isPending = task.status === "pending_approval";
          const isCompleting = completingId === task.id;

          return (
            <div key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">{TYPE_LABELS[task.task_type]}</span>
                  <span className="text-[10px] text-muted-foreground">→ {task.owner}</span>
                  {task.isInternalAuto && (
                    <Badge variant="secondary" className="text-[10px] h-4">
                      Auto · internal
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", cfg.className)}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
                {isPending && onApprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={isCompleting}
                    onClick={() => handleCompleteTask(task.id)}
                  >
                    {isCompleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Complete task
                  </Button>
                )}
                {isPending && onReject && (
                  <button
                    type="button"
                    onClick={() => onReject(task.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BriefDetailCard>
  );
}

export type CrmTask = TaskItem;
export { TaskList as CrmTaskList };
