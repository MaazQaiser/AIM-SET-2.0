"use client";

import { CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { usePrepReady } from "@/stores/use-call-workflow";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface PreDcPrepReadyActionProps {
  callId: string;
  className?: string;
  compact?: boolean;
}

export function PreDcPrepReadyAction({
  callId,
  className,
  compact = true,
}: PreDcPrepReadyActionProps) {
  const { isIntercom } = useThemePreview();
  const { isReady, markReady, clearReady } = usePrepReady(callId);

  function handleClick() {
    if (isReady) {
      clearReady();
      toast.message("Prep marked as in progress");
      return;
    }
    markReady();
    toast.success("Marked as ready — pod can join when the call starts");
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {isReady ? (
        <Badge
          variant="outline"
          className="h-6 gap-1 border-success/40 bg-success/10 text-success text-xs font-semibold"
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Prep ready
        </Badge>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={isReady ? "outline" : "default"}
        className={cn(
          compact ? "h-8 rounded-full px-4 text-sm font-bold" : "",
          !isReady && isIntercom && "bg-[#111111] text-white hover:bg-[#111111]/90"
        )}
        onClick={handleClick}
      >
        {isReady ? (
          <>
            <CircleDashed className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Undo ready
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Mark as ready
          </>
        )}
      </Button>
    </div>
  );
}
