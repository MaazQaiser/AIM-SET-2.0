"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import type { ModelPolicy } from "@/types/agents";

interface ModelPolicyBadgeProps {
  policy: ModelPolicy;
  showFallback?: boolean;
}

const TIER_COLOR: Record<string, string> = {
  haiku: "bg-green-100 text-green-700 border-green-200",
  sonnet: "bg-blue-100 text-blue-700 border-blue-200",
  opus: "bg-purple-100 text-purple-700 border-purple-200",
};

export function ModelPolicyBadge({ policy, showFallback = false }: ModelPolicyBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TIER_COLOR[policy.primary] ?? "bg-muted text-muted-foreground"}`}
          >
            {policy.model_name.split("-").slice(0, 3).join("-")}
          </span>
        </TooltipTrigger>
        <TooltipContent>Primary model · {policy.primary} tier</TooltipContent>
      </Tooltip>

      {showFallback && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
              ↓ {policy.fallback_model_name.split("-").slice(0, 3).join("-")}
            </span>
          </TooltipTrigger>
          <TooltipContent>Fallback model · {policy.fallback} tier</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
