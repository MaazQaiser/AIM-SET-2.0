"use client";

import { useId, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Card } from "@dc-copilot/ui/components/card";
import {
  liveColumnHorizontalPadding,
} from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";

interface LiveWidgetAccordionCardProps {
  icon: LucideIcon;
  title: string;
  summary?: string;
  extra?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  testId?: string;
  children: React.ReactNode;
}

export function LiveWidgetAccordionCard({
  icon: Icon,
  title,
  summary,
  extra,
  defaultOpen = true,
  className,
  bodyClassName,
  testId,
  children,
}: LiveWidgetAccordionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <Card
      className={cn("flex min-h-0 shrink-0 flex-col overflow-hidden", className)}
      data-testid={testId}
    >
      <button
        type="button"
        className={cn(
          "flex h-11 w-full shrink-0 items-center justify-between gap-3 border-b border-border/60 text-left transition-colors hover:bg-muted/30",
          liveColumnHorizontalPadding
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate type-caption font-medium text-muted-foreground">
            {title}
          </span>
          {summary && (
            <span className="hidden min-w-0 truncate type-caption text-muted-foreground/80 2xl:inline">
              {summary}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {extra}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>
      {open && (
        <div id={panelId} className={cn("min-h-0", bodyClassName)}>
          {children}
        </div>
      )}
    </Card>
  );
}
