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
          variant="success"
          className="h-7 gap-1.5 border-transparent bg-success px-3 text-white type-label font-bold"
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
          compact
            ? isReady
              ? "h-7 gap-1.5 rounded-full px-2.5 type-caption font-semibold shadow-none"
              : "h-8 rounded-full px-4 type-body font-bold"
            : "",
          !isReady && isIntercom && "bg-[#111111] text-white hover:bg-[#111111]/90"
        )}
        onClick={handleClick}
        aria-label={isReady ? "Undo ready" : "Mark prep as ready"}
      >
        {isReady ? (
          <>
            <CircleDashed className="h-3 w-3" aria-hidden />
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
