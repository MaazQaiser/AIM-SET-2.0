"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface LivePanelColumnProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** When false, children manage their own scroll (e.g. transcript viewer). */
  scrollable?: boolean;
  className?: string;
  bodyClassName?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
}

/** Consistent live-call column shell with collapse/expand. */
export function LivePanelColumn({
  title,
  children,
  defaultOpen = true,
  scrollable = true,
  className,
  bodyClassName,
  headerExtra,
  footer,
}: LivePanelColumnProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={cn("flex flex-col overflow-hidden min-h-0 min-w-0", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-border bg-card/80 px-3 py-2 text-left hover:bg-muted/40 transition-colors shrink-0"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
        <span className="text-xs font-semibold text-muted-foreground flex-1 truncate">
          {title}
        </span>
        {headerExtra}
      </button>
      {open && (
        <div id={panelId} className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div
            className={cn(
              "flex-1 min-h-0",
              scrollable ? "overflow-y-auto p-3" : "flex flex-col overflow-hidden",
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer && <div className="shrink-0 border-t border-border p-3">{footer}</div>}
        </div>
      )}
    </div>
  );
}
