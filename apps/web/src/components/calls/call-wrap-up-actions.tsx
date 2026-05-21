"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunPostCallPipeline } from "@/lib/data/hooks";
import { FRANCHISE_DEMO_CALL_ID } from "@/lib/demo/franchise-ai-platform-demo";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface CallWrapUpActionsProps {
  callId: string;
  hasReview?: boolean;
  /** Show link back to live cockpit */
  showLiveLink?: boolean;
  className?: string;
  /** Compact = single row for live header */
  variant?: "default" | "compact";
}

export function CallWrapUpActions({
  callId,
  hasReview = true,
  showLiveLink = false,
  variant = "default",
  className,
}: CallWrapUpActionsProps) {
  const router = useRouter();
  const wrapUp = useRunPostCallPipeline(callId);
  const isDemo = callId === FRANCHISE_DEMO_CALL_ID;

  async function handleEndAndReview() {
    try {
      if (!isDemo) {
        await wrapUp.mutateAsync();
        toast.success("Call ended — post-call review ready");
      } else {
        toast.success("Opening Post-DC review (demo scenario)");
      }
    } catch {
      if (hasReview || isDemo) {
        toast.message("Showing Post-DC review", {
          description: "Pipeline unavailable — loaded saved review data.",
        });
      } else {
        toast.error("Could not run post-call pipeline");
        return;
      }
    }
    router.push(`/calls/${callId}/post-dc?wrapped=1`);
  }

  const previewHref = `/calls/${callId}/post-dc`;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {showLiveLink && (
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href={`/calls/${callId}/live`}>Live</Link>
          </Button>
        )}
        {(hasReview || isDemo) && (
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={previewHref}>Post-DC</Link>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={wrapUp.isPending}
          onClick={() => void handleEndAndReview()}
        >
          {wrapUp.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ClipboardCheck className="h-3 w-3 mr-1" />
          )}
          Wrap up
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showLiveLink && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/calls/${callId}/live`}>
            <PlayCircle className="h-4 w-4 mr-1.5" />
            Live cockpit
          </Link>
        </Button>
      )}
      {(hasReview || isDemo) && (
        <Button asChild variant="secondary" size="sm">
          <Link href={previewHref}>Preview Post-DC</Link>
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        disabled={wrapUp.isPending}
        onClick={() => void handleEndAndReview()}
      >
        {wrapUp.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
        ) : (
          <ClipboardCheck className="h-4 w-4 mr-1.5" />
        )}
        End call &amp; review
      </Button>
    </div>
  );
}
