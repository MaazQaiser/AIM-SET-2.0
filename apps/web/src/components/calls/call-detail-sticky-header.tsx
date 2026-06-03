"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { PreDcBantStrip } from "@/components/calls/pre-dc-bant-strip";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";
import type { BANTScore, Call } from "@/types";

interface CallDetailStickyHeaderProps {
  call: Call;
  scheduleText: string;
  bant?: BANTScore;
  compact: boolean;
  showJoinCall: boolean;
  isEditingLayout: boolean;
  onToggleLayout: () => void;
}

function HeaderIconTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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
  className,
}: {
  isEditingLayout: boolean;
  onToggleLayout: () => void;
  className?: string;
}) {
  const { isIntercom } = useThemePreview();
  const label = isEditingLayout ? "Done customizing layout" : "Layout settings";

  return (
    <HeaderIconTooltip label={label}>
      <Button
        type="button"
        variant={isEditingLayout ? (isIntercom ? "ghost" : "default") : "ghost"}
        size="icon"
        className={cn("h-9 w-9 shrink-0", isIntercom && "text-[#111111]", className)}
        onClick={onToggleLayout}
        aria-label={label}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </HeaderIconTooltip>
  );
}

function BackToCallsButton({ className }: { className?: string }) {
  const { isIntercom } = useThemePreview();

  return (
    <HeaderIconTooltip label="Back to calls">
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={cn("shrink-0", isIntercom && "text-[#111111]", className)}
      >
        <Link href="/calls" aria-label="Back to calls">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
    </HeaderIconTooltip>
  );
}

function CompactHeaderBar({
  call,
  bant,
  showJoinCall,
  isEditingLayout,
  onToggleLayout,
}: {
  call: Call;
  bant?: BANTScore;
  showJoinCall: boolean;
  isEditingLayout: boolean;
  onToggleLayout: () => void;
}) {
  const { isIntercom } = useThemePreview();
  const isLive = call.status === "live";
  const showActionBar = Boolean(bant) || showJoinCall;

  return (
    <div className="flex h-12 w-full min-w-0 items-center gap-3 px-6 sm:gap-3.5 sm:px-8">
      <BackToCallsButton className="h-9 w-9" />
      <h1
        className={cn(
          "min-w-0 flex-1 truncate text-base font-extrabold leading-none tracking-tight",
          isIntercom ? "text-[#111111]" : "text-foreground"
        )}
      >
        {call.accountName}
      </h1>
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
        className="h-9 w-9"
      />
    </div>
  );
}

export function CallDetailStickyHeader({
  call,
  scheduleText,
  bant,
  compact,
  showJoinCall,
  isEditingLayout,
  onToggleLayout,
}: CallDetailStickyHeaderProps) {
  const { isIntercom } = useThemePreview();
  const isLive = call.status === "live";
  const showActionBar = Boolean(bant) || showJoinCall;
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const compactNav = (
    <header
      className={cn(
        "call-detail-compact-nav call-detail-liquid-glass call-detail-urbanist",
        "flex min-h-[3.75rem] items-center"
      )}
      data-visible={compact ? "true" : "false"}
      role="banner"
      aria-hidden={!compact}
    >
      <CompactHeaderBar
        call={call}
        bant={bant}
        showJoinCall={showJoinCall}
        isEditingLayout={isEditingLayout}
        onToggleLayout={onToggleLayout}
      />
    </header>
  );

  return (
    <>
      {compact && <div className="h-[3.75rem] shrink-0" aria-hidden />}

      {portalRoot ? createPortal(compactNav, portalRoot) : null}

      {!compact && (
        <header className="sticky top-0 z-30 w-full pt-9 pb-7 px-16 md:px-24 lg:px-32 bg-transparent transition-[padding,background-color] duration-200">
          <div className="relative mx-auto w-full max-w-[1480px]">
            <div className="absolute left-0 top-0 z-10">
              <BackToCallsButton className="h-9 w-9" />
            </div>
            <div className="absolute right-0 top-0 z-10">
              <LayoutSettingsButton
                isEditingLayout={isEditingLayout}
                onToggleLayout={onToggleLayout}
              />
            </div>

            <div className="flex flex-col items-center text-center gap-1 px-24 sm:px-32 pt-3 min-w-0">
              <h1
                className={cn(
                  "text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-snug max-w-4xl",
                  isIntercom ? "text-[#111111]" : "text-foreground"
                )}
              >
                {call.accountName}
              </h1>
              <div
                className={cn(
                  "flex flex-wrap items-center justify-center gap-x-2 gap-y-2 mt-4 text-sm font-medium",
                  isIntercom ? "text-[#626260]" : "text-muted-foreground"
                )}
              >
                {call.leadName && (
                  <span className="font-bold text-foreground/90">
                    {call.leadName}
                    {call.leadTitle ? ` · ${call.leadTitle}` : ""}
                  </span>
                )}
                <span>{scheduleText}</span>
                {!isIntercom && (
                  <Badge variant="secondary" className="text-xs h-5 font-bold">
                    Pre-DC
                  </Badge>
                )}
                {call.annualRevenue && !isIntercom && (
                  <Badge variant="outline" className="text-xs font-mono h-5">
                    {call.annualRevenue}
                  </Badge>
                )}
                <AIGeneratedBadge />
              </div>

              {showActionBar && (
                <PreDcBantStrip
                  bant={bant}
                  callId={call.id}
                  showJoinCall={showJoinCall}
                  isLive={isLive}
                  className="mt-6"
                />
              )}
            </div>
          </div>
        </header>
      )}
    </>
  );
}
