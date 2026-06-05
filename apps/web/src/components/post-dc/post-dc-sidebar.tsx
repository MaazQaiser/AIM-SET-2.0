"use client";

import {
  AccountSnapshotCard,
  type AccountSnapshotRow,
} from "@/components/calls/account-widget-cards";
import { PostDcBantPanel } from "@/components/post-dc/post-dc-bant-panel";
import type { PostCallReview } from "@/lib/brief-types";
import type { BANTScore } from "@/types";
import { cn } from "@/lib/cn";

interface PostDcSidebarProps {
  accountSnapshot: AccountSnapshotRow[];
  review: PostCallReview;
  bant: BANTScore;
  className?: string;
}

export function PostDcSidebar({
  accountSnapshot,
  review,
  bant,
  className,
}: PostDcSidebarProps) {
  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col gap-4 lg:sticky lg:top-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
        className
      )}
      aria-label="Post-DC account context"
    >
      <AccountSnapshotCard rows={accountSnapshot} />
      <PostDcBantPanel bant={bant} review={review} />
    </aside>
  );
}
