"use client";

import { cn } from "@/lib/cn";

interface PostDcTasksProgressBarProps {
  done: number;
  total: number;
  className?: string;
  /** Sidebar rail — bar only; count lives in card header */
  compact?: boolean;
}

/** Horizontal progress for workflow task completion. */
export function PostDcTasksProgressBar({
  done,
  total,
  className,
  compact = false,
}: PostDcTasksProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const pct = total > 0 ? Math.round((done / safeTotal) * 100) : 0;

  return (
    <div className={cn(compact ? "space-y-0" : "space-y-1.5", className)} aria-label="Task progress">
      {!compact ? (
        <div className="flex items-center justify-between gap-2 type-caption text-muted-foreground">
          <span className="font-medium">Wrap-up progress</span>
          <span className="tabular-nums shrink-0">
            {done} of {total} complete
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          compact ? "h-2" : "h-2.5"
        )}
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={compact ? `${done} of ${total} tasks complete` : undefined}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
