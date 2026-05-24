"use client";

import { useState } from "react";
import { Activity, Zap, DollarSign, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { cn } from "@/lib/cn";

interface LiveCallAgentStatusProps {
  isActive?: boolean;
  nudgesSent?: number;
  nudgesCap?: number;
  costUsd?: number;
  latencyMs?: number;
  onToggle?: (active: boolean) => void;
  className?: string;
}

export function LiveCallAgentStatus({
  isActive = true,
  nudgesSent = 0,
  nudgesCap = 3,
  costUsd = 0,
  latencyMs,
  onToggle,
  className,
}: LiveCallAgentStatusProps) {
  const [active, setActive] = useState(isActive);

  function toggle() {
    const next = !active;
    setActive(next);
    onToggle?.(next);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border text-xs",
        active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/50",
        className
      )}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            active ? "bg-success animate-live-pulse" : "bg-muted-foreground"
          )}
        />
        <span className="font-medium text-muted-foreground">Live Call Agent</span>
        {active && (
          <Badge className="h-4 text-[10px] px-1 bg-success/10 text-success border-success/30 border">
            Active
          </Badge>
        )}
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Nudge count */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className={cn(nudgesSent >= nudgesCap && "text-warning font-medium")}>
              {nudgesSent}/{nudgesCap}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Nudges sent / window cap</TooltipContent>
      </Tooltip>

      {/* Cost */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>{costUsd.toFixed(3)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Call cost so far</TooltipContent>
      </Tooltip>

      {/* Latency */}
      {latencyMs !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>{latencyMs}ms</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Last LLM response latency</TooltipContent>
        </Tooltip>
      )}

      {/* Toggle */}
      {onToggle && (
        <>
          <div className="h-3 w-px bg-border ml-auto" />
          <button
            type="button"
            onClick={toggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={active ? "Disable Live Call Agent" : "Enable Live Call Agent"}
          >
            {active
              ? <ToggleRight className="h-4 w-4 text-primary" />
              : <ToggleLeft className="h-4 w-4" />}
          </button>
        </>
      )}
    </div>
  );
}
