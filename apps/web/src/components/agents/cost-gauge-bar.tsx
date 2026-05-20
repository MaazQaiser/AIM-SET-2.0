"use client";

import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CostGaugeBarProps {
  spentUsd: number;
  capUsd: number;
  capLabel?: string;
  className?: string;
}

export function CostGaugeBar({ spentUsd, capUsd, capLabel = "cap", className }: CostGaugeBarProps) {
  const safeCap = capUsd > 0 ? capUsd : 0.01;
  const pct = Math.min((spentUsd / safeCap) * 100, 100);
  const isWarning = pct >= 75;
  const isDanger = pct >= 90;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("space-y-1", className)}>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>${spentUsd.toFixed(2)} today</span>
            <span>
              ${safeCap.toFixed(2)} {capLabel}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isDanger ? "bg-destructive" : isWarning ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {pct.toFixed(0)}% of {capLabel} ({spentUsd.toFixed(2)} / ${safeCap.toFixed(2)})
      </TooltipContent>
    </Tooltip>
  );
}
