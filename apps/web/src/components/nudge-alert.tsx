"use client";

import { Zap, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@dc-copilot/ui/components/button";
import { CitationMarker } from "./citation-marker";
import type { NudgePayload } from "@/types";

interface NudgeAlertProps {
  nudge: NudgePayload;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function NudgeAlert({ nudge, onAccept, onDismiss }: NudgeAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-nudge/30 bg-nudge/10 p-3",
        "animate-in slide-in-from-bottom-2 fade-in-0"
      )}
    >
      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-nudge" aria-hidden />
      <div className="flex-1 min-w-0">
        {nudge.source === "discovery-checklist" && (
          <span className="type-caption font-medium text-primary mb-1 block">
            Discovery
          </span>
        )}
        <p className="type-body text-foreground">
          {nudge.message}
          <CitationMarker index={1} citation={nudge.citation} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
          onClick={() => onAccept(nudge.id)}
          aria-label="Accept suggestion"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onDismiss(nudge.id)}
          aria-label="Dismiss suggestion"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
