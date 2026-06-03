"use client";

import { AccountSnapshotCard, type AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import { PostDcClpActivityCard } from "@/components/post-dc/post-dc-clp-activity-card";
import { PostDcClpStatusCard } from "@/components/post-dc/post-dc-clp-status-card";
import type { PostCallReview } from "@/lib/brief-types";
import type { CustomerLandingPage } from "@dc-copilot/types";
import { cn } from "@/lib/cn";

interface PostDcSidebarProps {
  callId: string;
  accountSnapshot: AccountSnapshotRow[];
  review: PostCallReview;
  landingPage?: CustomerLandingPage | null;
  className?: string;
}

export function PostDcSidebar({
  callId,
  accountSnapshot,
  review,
  landingPage,
  className,
}: PostDcSidebarProps) {
  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col gap-4 lg:sticky lg:top-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
        className
      )}
      aria-label="Post-DC context and landing page"
    >
      {accountSnapshot.length > 0 && <AccountSnapshotCard rows={accountSnapshot} />}
      <PostDiscoveryGapsCard
        gaps={review.openDiscoveryGaps ?? []}
        bantCoverage={review.discoveryBantCoverage}
      />
      <PostDcClpStatusCard callId={callId} page={landingPage} />
      <PostDcClpActivityCard callId={callId} enabled={landingPage?.status === "published"} />
    </aside>
  );
}
