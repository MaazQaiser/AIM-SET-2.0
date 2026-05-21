"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface LiveCollapsibleSectionProps {
  title: string;
  /** Shown in the trigger when collapsed (and as subtitle when open). */
  summary?: string;
  count?: number;
  /** Opens on first render when true; user can still collapse. */
  defaultOpen?: boolean;
  variant?: "default" | "attention";
  children: React.ReactNode;
}

export function LiveCollapsibleSection({
  title,
  summary,
  count,
  defaultOpen = false,
  variant = "default",
  children,
}: LiveCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={cn(
        "rounded-lg border",
        variant === "attention"
          ? "border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20"
          : "border-border bg-card/50"
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-lg"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{title}</span>
            {count != null && count > 0 && (
              <Badge variant={variant === "attention" ? "warning" : "secondary"} className="text-[10px] px-1.5 py-0">
                {count}
              </Badge>
            )}
          </div>
          {summary && (
            <p
              className={cn(
                "text-[11px] text-muted-foreground mt-0.5",
                !open && "line-clamp-1"
              )}
            >
              {summary}
            </p>
          )}
        </div>
      </button>
      {open && (
        <div id={panelId} className="px-3 pb-3 pt-0 border-t border-border/60">
          {children}
        </div>
      )}
    </div>
  );
}
