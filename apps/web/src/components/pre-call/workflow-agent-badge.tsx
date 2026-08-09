"use client";

import Link from "next/link";
import { Workflow } from "lucide-react";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";

interface WorkflowAgentBadgeProps {
  className?: string;
}

/** Labels content produced by PRE-DC Workflow; links to agent configuration. */
export function WorkflowAgentBadge({ className }: WorkflowAgentBadgeProps) {
  const { isIntercom } = useThemePreview();

  return (
    <Link
      href="/agents/workflow/config"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 type-label transition-colors",
        isIntercom
          ? "border border-[#ff5600]/20 bg-[#ff5600]/10 text-[#ff5600] hover:bg-[#ff5600]/15"
          : "rounded-sm bg-primary/10 text-primary hover:bg-primary/15",
        className
      )}
      title="Open PRE-DC Workflow settings"
    >
      <Workflow className="h-3 w-3 shrink-0" />
      PRE-DC Workflow
    </Link>
  );
}
