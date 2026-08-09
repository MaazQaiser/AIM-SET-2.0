"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { cn } from "@/lib/cn";
import type { AgentId } from "@/types/agents";

const LABELS: Partial<Record<AgentId, string>> = {
  workflow: "PRE-DC agent settings",
  "live-call": "Live Call agent settings",
  post_dc: "Post-DC agent settings",
};

interface AgentConfigLinkProps {
  agentId: AgentId;
  /** icon = header button; text = inline text link */
  variant?: "icon" | "text" | "button";
  className?: string;
  label?: string;
}

/** Shortcut into /agents/[id]/config from Pre-DC, Live Call, etc. */
export function AgentConfigLink({
  agentId,
  variant = "icon",
  className,
  label,
}: AgentConfigLinkProps) {
  const href = `/agents/${agentId}/config`;
  const resolvedLabel = label ?? LABELS[agentId] ?? "Agent settings";

  if (variant === "text") {
    return (
      <Link
        href={href}
        className={cn(
          "type-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
          className
        )}
      >
        {resolvedLabel}
      </Link>
    );
  }

  if (variant === "button") {
    return (
      <Button asChild variant="outline" size="sm" className={cn("gap-1.5 h-8", className)}>
        <Link href={href}>
          <Bot className="h-3.5 w-3.5" />
          {resolvedLabel}
        </Link>
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 shrink-0", className)}
        >
          <Link href={href} aria-label={resolvedLabel}>
            <Bot className="h-4 w-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="type-label">
        {resolvedLabel}
      </TooltipContent>
    </Tooltip>
  );
}
