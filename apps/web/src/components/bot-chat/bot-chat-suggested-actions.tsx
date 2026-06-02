"use client";

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
}

const categoryLabel: Record<SuggestedAction["category"], string> = {
  prepare: "Prepare",
  live: "During call",
  "follow-up": "Follow-up",
};

export function BotChatSuggestedActions({
  actions,
  onSelect,
  disabled,
  className,
  buttonClassName,
}: BotChatSuggestedActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className={cn("shrink-0 border-b border-border px-3 py-2.5 space-y-2", className)}>
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
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
              "h-auto min-h-7 py-1 px-2 text-[11px] font-normal text-left whitespace-normal max-w-full",
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
