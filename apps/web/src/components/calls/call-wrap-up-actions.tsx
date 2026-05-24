"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, PlayCircle, Presentation } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { useRunPostCallPipeline } from "@/lib/data/hooks";
import { FRANCHISE_DEMO_CALL_ID } from "@/lib/demo/franchise-ai-platform-demo";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import { createDeckFromCall } from "@/lib/content-studio/create-deck-from-call";
import { useLiveCall } from "@/stores/use-live-call";

interface CallWrapUpActionsProps {
  callId: string;
  accountName?: string;
  hasReview?: boolean;
  /** Show link back to live cockpit */
  showLiveLink?: boolean;
  className?: string;
  /** Compact = single row for live header */
  variant?: "default" | "compact";
}

export function CallWrapUpActions({
  callId,
  accountName,
  hasReview = true,
  showLiveLink = false,
  variant = "default",
  className,
}: CallWrapUpActionsProps) {
  const router = useRouter();
  const wrapUp = useRunPostCallPipeline(callId);
  const isDemo = callId === FRANCHISE_DEMO_CALL_ID;
  const [creatingDeck, setCreatingDeck] = useState(false);
  const transcript = useLiveCall((s) => s.transcript);
  const checklistState = useLiveCall((s) => s.checklistState);
  const intentSnapshot = useLiveCall((s) => s.intentSnapshot);

  async function handleCreateDeck() {
    setCreatingDeck(true);
    try {
      const projectId = await createDeckFromCall({
        callId,
        accountName: accountName ?? "Discovery Call",
        transcript,
        checklistState,
        intentLabel: intentSnapshot?.intent?.label,
      });
      toast.success("Deck project created — generating slides from pain points");
      router.push(`/content/studio/${projectId}`);
    } catch {
      toast.error("Failed to create deck project");
    } finally {
      setCreatingDeck(false);
    }
  }

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
          variant="secondary"
          className="h-8 text-xs"
          disabled={creatingDeck}
          onClick={() => void handleCreateDeck()}
        >
          {creatingDeck ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Presentation className="h-3 w-3 mr-1" />
          )}
          Create Deck
        </Button>
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
        variant="secondary"
        disabled={creatingDeck}
        onClick={() => void handleCreateDeck()}
      >
        {creatingDeck ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
        ) : (
          <Presentation className="h-4 w-4 mr-1.5" />
        )}
        Create Deck
      </Button>
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
