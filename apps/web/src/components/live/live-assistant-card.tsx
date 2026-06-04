"use client";

import {
  AlertTriangle,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { cn } from "@/lib/cn";

export type AssistantCardKind = "alert" | "insight" | "question" | "content";

const kindConfig: Record<
  AssistantCardKind,
  { label: string; icon: typeof AlertTriangle; accent: string }
> = {
  alert: {
    label: "Alert",
    icon: AlertTriangle,
    accent: "text-destructive",
  },
  insight: {
    label: "Insight",
    icon: Lightbulb,
    accent: "text-primary",
  },
  question: {
    label: "Question",
    icon: HelpCircle,
    accent: "text-primary",
  },
  content: {
    label: "Content",
    icon: BookOpen,
    accent: "text-primary",
  },
};

export interface LiveAssistantCardProps {
  id: string;
  kind: AssistantCardKind;
  message: string;
  contextLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function LiveAssistantCard({
  kind,
  message,
  contextLabel,
  actionLabel,
  onAction,
  onDismiss,
  className,
}: LiveAssistantCardProps) {
  const cfg = kindConfig[kind];
  const Icon = cfg.icon;

  return (
    <article
      className={cn(
        "app-card relative px-3.5 py-3 shadow-none",
        className
      )}
    >
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1.5 h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <div className="flex items-center gap-1.5 pr-6">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.accent)} aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {cfg.label}
        </span>
      </div>

      <p className="mt-2 text-sm leading-snug text-foreground">{message}</p>

      {(contextLabel || actionLabel) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {contextLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              {contextLabel}
            </span>
          ) : (
            <span />
          )}
          {actionLabel && onAction && (
            <Button type="button" size="sm" className="h-7 text-xs shrink-0" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
