"use client";

import { BotChatPanel } from "@/components/bot-chat-panel";
import { briefCardShellClass } from "@/components/pre-call/brief-detail-card";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PostDcChatColumnProps {
  callId: string;
  accountName: string;
  brief?: CallBrief | null;
  review?: PostCallReview | null;
  embedded?: boolean;
  className?: string;
}

/** Sticky right rail — AI chat for post-call wrap-up. */
export function PostDcChatColumn({
  callId,
  accountName,
  brief,
  review,
  embedded = false,
  className,
}: PostDcChatColumnProps) {
  const openGaps = review?.openDiscoveryGaps?.map((g) => g.toLowerCase()) ?? [];

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col",
        !embedded && "lg:sticky lg:top-2 lg:max-h-[calc(100vh-6rem)]",
        className
      )}
      aria-label="AI chat"
    >
      <div
        className={cn(
          briefCardShellClass,
          "flex min-h-0 flex-col overflow-hidden shadow-none",
          embedded ? "min-h-[360px] h-[360px]" : "h-[min(640px,calc(100vh-6rem))] min-h-[420px]"
        )}
      >
        <BotChatPanel
          callId={callId}
          variant="embedded"
          phase="wrapup"
          accountName={accountName}
          brief={brief}
          className="flex-1 min-h-0 border-0 rounded-none bg-transparent"
          openGaps={openGaps}
          bantCoveragePct={
            review?.discoveryBantCoverage !== undefined
              ? Math.round(review.discoveryBantCoverage * 100)
              : undefined
          }
          copilotOnly
        />
      </div>
    </aside>
  );
}
