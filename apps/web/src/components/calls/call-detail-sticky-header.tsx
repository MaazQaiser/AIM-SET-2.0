"use client";

import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { PreDcBantStrip } from "@/components/calls/pre-dc-bant-strip";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";
import type { BANTScore, Call } from "@/types";

interface CallDetailStickyHeaderProps {
  call: Call;
  scheduleText: string;
  bant?: BANTScore;
  showJoinCall: boolean;
  isEditingLayout: boolean;
  onToggleLayout: () => void;
}

function HeaderIconTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function LayoutSettingsButton({
  isEditingLayout,
  onToggleLayout,
}: {
  isEditingLayout: boolean;
  onToggleLayout: () => void;
}) {
  const { isIntercom } = useThemePreview();
  const label = isEditingLayout ? "Done customizing layout" : "Layout settings";

  return (
    <HeaderIconTooltip label={label}>
      <Button
        type="button"
        variant={isEditingLayout ? (isIntercom ? "ghost" : "default") : "ghost"}
        size="icon"
        className={cn("h-9 w-9 shrink-0", isIntercom && "text-[#111111]")}
        onClick={onToggleLayout}
        aria-label={label}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </HeaderIconTooltip>
  );
}

function BackToCallsButton() {
  const { isIntercom } = useThemePreview();

  return (
    <HeaderIconTooltip label="Back to calls">
      <Button
        asChild
        variant="outline"
        size="icon"
        className={cn(
          "h-9 w-9 shrink-0 border-slate-300 bg-background shadow-none",
          "hover:border-slate-400 hover:bg-slate-50",
          isIntercom && "border-[#d1d1cd] bg-[#f7f5f3] hover:bg-[#ebe7e1] hover:border-[#b8b8b4]"
        )}
      >
        <Link href="/calls" aria-label="Back to calls">
          <ArrowLeft
            className={cn(
              "h-4 w-4 text-slate-600",
              isIntercom && "text-[#626260]"
            )}
            strokeWidth={1.75}
          />
        </Link>
      </Button>
    </HeaderIconTooltip>
  );
}

export function CallDetailStickyHeader({
  call,
  scheduleText,
  bant,
  showJoinCall,
  isEditingLayout,
  onToggleLayout,
}: CallDetailStickyHeaderProps) {
  const { isIntercom } = useThemePreview();
  const isLive = call.status === "live";
  const showActionBar = Boolean(bant) || showJoinCall;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-6 border-b border-border/50 bg-background/90 px-6 pb-5 pt-2 backdrop-blur-md sm:-mx-8 sm:px-8",
        isIntercom && "border-[#e8e6e3] bg-[#f7f5f3]/95"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <BackToCallsButton />
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "type-headline truncate text-foreground sm:type-display",
                isIntercom && "text-[#111111]"
              )}
            >
              {call.accountName}
            </h1>
            <div
              className={cn(
                "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-body-sm",
                isIntercom ? "text-[#626260]" : "text-muted-foreground"
              )}
            >
              {call.leadName && (
                <span className="font-semibold text-foreground/90">
                  {call.leadName}
                  {call.leadTitle ? ` · ${call.leadTitle}` : ""}
                </span>
              )}
              <span>{scheduleText}</span>
              {!isIntercom && (
                <Badge variant="secondary" className="h-5 text-xs font-bold">
                  Pre-DC
                </Badge>
              )}
              {call.annualRevenue && !isIntercom && (
                <Badge variant="outline" className="h-5 font-mono text-xs">
                  {call.annualRevenue}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showActionBar && (
            <PreDcBantStrip
              bant={bant}
              callId={call.id}
              showJoinCall={showJoinCall}
              isLive={isLive}
              compact
              className="mx-0 shrink-0"
            />
          )}
          <LayoutSettingsButton
            isEditingLayout={isEditingLayout}
            onToggleLayout={onToggleLayout}
          />
        </div>
      </div>
    </header>
  );
}
