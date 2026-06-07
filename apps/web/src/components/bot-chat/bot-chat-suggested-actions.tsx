"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import type { SuggestedAction } from "@/lib/bot-chat/types";
import { cn } from "@/lib/cn";

interface BotChatSuggestedActionsProps {
  actions: SuggestedAction[];
  onSelect: (action: SuggestedAction) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  /** chips = pill buttons (default); list = full-width text rows */
  variant?: "chips" | "list";
}

const categoryLabel: Record<SuggestedAction["category"], string> = {
  prepare: "Prepare",
  live: "During call",
  "follow-up": "Next steps",
};

export function BotChatSuggestedActions({
  actions,
  onSelect,
  disabled,
  className,
  buttonClassName,
  variant = "chips",
}: BotChatSuggestedActionsProps) {
  if (actions.length === 0) return null;

  if (variant === "list") {
    return (
      <div className={cn("shrink-0 border-b border-border/60", className)}>
        <div
          className={cn(
            "px-4 py-2 type-kicker",
            buttonClassName ? "call-detail-copilot-muted" : "text-muted-foreground"
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3" aria-hidden />
            Suggested
          </span>
        </div>
        <div className="divide-y divide-border/60">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors",
                "hover:bg-muted/40 disabled:opacity-50",
                buttonClassName
              )}
              onClick={() => onSelect(action)}
              title={action.prompt}
            >
              <span className="type-caption font-medium text-muted-foreground">
                {categoryLabel[action.category]}
              </span>
              <span className="type-label text-foreground leading-snug">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 border-b border-border px-3 py-2.5 space-y-2", className)}>
      <div
        className={cn(
          "flex items-center gap-1.5 type-caption font-medium",
          buttonClassName ? "call-detail-copilot-muted" : "text-muted-foreground"
        )}
      >
        <Lightbulb className="h-3 w-3" aria-hidden />
        Suggested actions
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-auto min-h-7 py-1 px-2 type-caption font-normal text-left whitespace-normal max-w-full",
              buttonClassName
            )}
            onClick={() => onSelect(action)}
            title={action.prompt}
          >
            <span
              className={cn(
                "mr-1",
                buttonClassName ? "call-detail-copilot-muted" : "text-muted-foreground"
              )}
            >
              {categoryLabel[action.category]} ·
            </span>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
