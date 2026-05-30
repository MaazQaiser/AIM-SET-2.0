"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Info, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export interface BriefSourceInfo {
  source: string;
  detail: string;
}

export interface BriefDetailCardProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  /** default = standard card; highlight = AI summary; warning = signals */
  variant?: "default" | "highlight" | "warning";
  /** Scrollable body with optional max height (e.g. "10rem" for ~3 peek rows) */
  scrollMaxHeight?: string;
  headerExtra?: ReactNode;
  sourceInfo?: BriefSourceInfo;
  className?: string;
}

function SourceInfoIcon({ info }: { info: BriefSourceInfo }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`How ${info.source} was used for this section`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs space-y-1.5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Source: {info.source}
          </p>
          <p className="text-xs leading-relaxed">{info.detail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BriefDetailCard({
  title,
  icon: Icon,
  children,
  variant = "default",
  scrollMaxHeight,
  headerExtra,
  sourceInfo,
  className,
}: BriefDetailCardProps) {
  return (
    <Card
      className={cn(
        "flex min-h-0 w-full flex-col shadow-none",
        variant === "highlight" && "border-primary/25 bg-gradient-to-br from-primary/5 to-accent/20",
        variant === "warning" && "border-warning/35",
        className
      )}
    >
      <CardHeader className="shrink-0 space-y-0 pb-3">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 min-w-0">
            {Icon && (
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  variant === "highlight" && "text-primary",
                  variant === "warning" && "text-warning"
                )}
              />
            )}
            <span className="truncate">{title}</span>
            {sourceInfo ? <SourceInfoIcon info={sourceInfo} /> : null}
          </CardTitle>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "min-h-0 pt-0",
          scrollMaxHeight && "overflow-y-auto overflow-x-hidden"
        )}
        style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/** Row inside brief cards — use `plain` for label/value facts (no inner box). */
export function BriefDetailRow({
  children,
  className,
  plain = false,
}: {
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        plain ? "py-1" : "rounded-lg border border-border bg-muted/20 px-3 py-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Definition list for plain informational fields (industry, revenue, etc.). */
export function BriefDetailFields({
  rows,
  className,
}: {
  rows: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <dl className={cn("space-y-3", className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {row.label}
          </dt>
          <dd className="text-sm font-medium leading-snug break-words mt-0.5">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BriefDetailAccordion({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden min-w-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/40 min-w-0"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="font-medium text-foreground">{title}</span>
          {summary && !open && (
            <span className="block text-xs text-muted-foreground truncate mt-0.5">{summary}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="border-t border-border px-3 py-2.5 bg-muted/15">{children}</div>}
    </div>
  );
}
