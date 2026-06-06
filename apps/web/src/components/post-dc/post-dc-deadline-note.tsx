"use client";

import { cn } from "@/lib/cn";
import { briefBodyClass, briefBodyForegroundClass } from "@/components/pre-call/brief-detail-card";

/** Plain deadline / key note — matches Pre-DC body typography. */
export function PostDcDeadlineNote({
  text,
  className,
  compact = false,
  showLabel = true,
}: {
  text: string;
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  return (
    <section className={cn("w-full min-w-0 pt-4 mt-3 border-t border-border/60", className)}>
      {showLabel ? (
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Deadline / key note</h3>
      ) : null}
      <p
        className={cn(
          "post-dc-copy break-words",
          compact ? briefBodyClass : briefBodyForegroundClass
        )}
      >
        {trimmed}
      </p>
    </section>
  );
}
