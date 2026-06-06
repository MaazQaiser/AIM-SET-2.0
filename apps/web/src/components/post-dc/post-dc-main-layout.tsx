"use client";

import { cn } from "@/lib/cn";

interface PostDcMainLayoutProps {
  children: React.ReactNode;
  tasksColumn?: React.ReactNode;
  embedded?: boolean;
}

/** Post-DC main + tasks rail — no left context rail. */
export function PostDcMainLayout({ children, tasksColumn, embedded = false }: PostDcMainLayoutProps) {
  const showTasksRail = Boolean(tasksColumn) && !embedded;

  return (
    <div className="space-y-4 min-w-0">
      <div
        className={cn(
          "grid gap-6 xl:gap-8",
          "grid-cols-1",
          showTasksRail && "lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.28fr)]",
          "lg:items-start"
        )}
      >
        <div className="min-w-0">{children}</div>
        {showTasksRail ? tasksColumn : null}
      </div>
      {embedded && tasksColumn ? <div className="min-w-0 pt-2">{tasksColumn}</div> : null}
    </div>
  );
}
