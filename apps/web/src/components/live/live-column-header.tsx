"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Shared column title row — fixed height keeps divider lines aligned across columns. */
export function LiveColumnHeader({
  icon: Icon,
  title,
  extra,
  className,
}: {
  icon: LucideIcon;
  title: string;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-transparent px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-[11px] font-semibold text-muted-foreground">
          {title}
        </span>
      </div>
      {extra}
    </div>
  );
}

/** Consistent horizontal padding beneath every live column header. */
export const liveColumnContentPadding = "px-5 py-4";

/** Scrollable column body beneath a live column header. */
export const liveColumnBodyClass =
  cn("flex min-h-0 flex-1 flex-col overflow-y-auto", liveColumnContentPadding);

/** Smaller in-column subsection label (e.g. BANT live, Keywords). */
export function LiveSubsectionHeader({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "mb-2 text-[10px] font-semibold text-muted-foreground",
        className
      )}
    >
      {title}
    </h3>
  );
}
