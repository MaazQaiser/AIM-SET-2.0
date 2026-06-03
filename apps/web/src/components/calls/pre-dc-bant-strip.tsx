"use client";

import Link from "next/link";
import { BANTScorecard } from "@/components/bant-scorecard";
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
        "call-detail-roboto mx-auto inline-flex w-fit max-w-full items-center text-left border shadow-none",
        compact ? "rounded-full py-1.5 pl-4 pr-2.5" : "rounded-full py-2 pl-3.5 pr-2",
        "border-border/80 bg-card",
        className
      )}
      aria-label="BANT and call actions"
    >
      {bant && <BANTScorecard bant={bant} layout="strip" stripScale="md" />}
      {showJoinCall && bant && (
        <span
          aria-hidden
          className={cn(
            compact ? "mx-3 h-8" : "mx-2.5 h-8",
            "w-px shrink-0 self-center",
            "bg-border"
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
