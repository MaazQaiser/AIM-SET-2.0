"use client";

import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const pendingTasks = tasks.filter((t) => t.status === "pending_approval");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === pendingTasks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingTasks.map((t) => t.id)));
    }
  }

  async function handleApproveSelected() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    onApprove?.([...selected]);
    setSelected(new Set());
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      {pendingTasks.length > 0 && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === pendingTasks.length && pendingTasks.length > 0}
              onChange={toggleAll}
              className="rounded border"
            />
            Select all pending ({pendingTasks.length})
          </label>
          {selected.size > 0 && (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleApproveSelected} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Mark {selected.size} done
            </Button>
          )}
        </div>
      )}

      <div className="divide-y rounded-md border">
        {tasks.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No tasks generated</div>
        )}

        {tasks.map((task) => {
          const cfg = STATUS_CONFIG[task.status];
          const Icon = cfg.icon;
          const isPending = task.status === "pending_approval";

          return (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3">
              {isPending && (
                <input
                  type="checkbox"
                  checked={selected.has(task.id)}
                  onChange={() => toggleSelect(task.id)}
                  className="mt-0.5 rounded border"
                />
              )}
              {!isPending && <div className="w-4 shrink-0" />}

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
                <p className="text-[10px] text-muted-foreground">Due {new Date(task.due_date).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", cfg.className)}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
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
    </div>
  );
}

export type CrmTask = TaskItem;
export { TaskList as CrmTaskList };
