"use client";

import Link from "next/link";
import { BANTScorecard } from "@/components/bant-scorecard";
import { briefCardShellClass } from "@/components/pre-call/brief-detail-card";
import { Button } from "@dc-copilot/ui/components/button";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";
import type { BANTScore } from "@/types";

interface PreDcBantStripProps {
  bant?: BANTScore;
  callId: string;
  showJoinCall?: boolean;
  isLive?: boolean;
  className?: string;
  compact?: boolean;
}

/** Slim bar: BANT row flush against Join call, separated by a vertical rule. */
export function PreDcBantStrip({
  bant,
  callId,
  showJoinCall = false,
  isLive = false,
  className,
  compact = false,
}: PreDcBantStripProps) {
  const { isIntercom } = useThemePreview();
  const joinLabel = isLive ? "Join live" : "Join call";

  if (!bant && !showJoinCall) return null;

  return (
    <div
      className={cn(
        "call-detail-urbanist",
        briefCardShellClass,
        "text-card-foreground shadow-none",
        "inline-flex w-fit max-w-full min-h-0 flex-row items-center overflow-hidden text-left",
        compact ? "gap-0 px-4 py-2" : "gap-0 px-5 py-2.5",
        className
      )}
      aria-label="BANT and call actions"
    >
      {bant && (
        <div className={cn(compact ? "px-1" : "px-0.5")}>
          <BANTScorecard bant={bant} layout="strip" stripScale="md" />
        </div>
      )}
      {showJoinCall && bant && (
        <span
          aria-hidden
          className={cn(
            compact ? "mx-3" : "mx-2.5",
            "h-8 w-px shrink-0 self-center bg-border/60"
          )}
        />
      )}
      {showJoinCall && (
        <Button
          asChild
          size="sm"
          className={cn(
            "h-8 shrink-0 rounded-full px-4 text-sm font-bold",
            isIntercom && "bg-[#111111] text-white hover:bg-[#111111]/90"
          )}
        >
          <Link href={`/calls/${callId}/live`}>{joinLabel}</Link>
        </Button>
      )}
    </div>
  );
}
