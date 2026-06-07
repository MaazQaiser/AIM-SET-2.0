"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { cn } from "@/lib/cn";

interface LiveCollapsibleSectionProps {
  title: string;
  /** Shown in the trigger when collapsed (and as subtitle when open). */
  summary?: string;
  count?: number;
  /** Opens on first render when true; user can still collapse. */
  defaultOpen?: boolean;
  variant?: "default" | "attention";
  /** Flush inside a parent app-card — no nested card chrome */
  inset?: boolean;
  /** Stacked in a shared list — no radius, no per-item border */
  flush?: boolean;
  className?: string;
  panelClassName?: string;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function LiveCollapsibleSection({
  title,
  summary,
  count,
  defaultOpen = false,
  variant = "default",
  inset = false,
  flush = false,
  className,
  panelClassName,
  onOpenChange,
  children,
}: LiveCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      onOpenChange?.(next);
      return next;
    });
  };

  return (
    <div
      className={cn(
        flush && "rounded-none border-0 bg-transparent",
        inset && !flush && "rounded-md",
        !inset &&
          !flush &&
          "rounded-lg border",
        !inset &&
          !flush &&
          (variant === "attention"
            ? "border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20"
            : "border-border bg-card/50"),
        flush &&
          variant === "attention" &&
          "bg-amber-50/40 dark:bg-amber-950/20",
        className
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full shrink-0 items-start text-left transition-colors hover:bg-muted/40",
          flush && "gap-2 rounded-none px-3 py-2",
          inset && !flush && "gap-1.5 rounded-md px-1 py-1",
          !inset && !flush && "gap-2 rounded-lg px-3 py-2"
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
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
            <span className="type-label text-foreground">{title}</span>
            {count != null && count > 0 && (
              <Badge variant={variant === "attention" ? "warning" : "secondary"} className="type-caption px-1.5 py-0">
                {count}
              </Badge>
            )}
          </div>
          {summary && !open && (
            <p className="mt-0.5 line-clamp-2 type-caption text-muted-foreground">{summary}</p>
          )}
        </div>
      </button>
      {open && (
        <div
          id={panelId}
          className={cn(
            "pt-0",
            flush && "border-t border-border/60 px-3 pb-3",
            inset && !flush && "px-1 pb-1",
            !inset && !flush && "border-t border-border/60 px-3 pb-3",
            panelClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
