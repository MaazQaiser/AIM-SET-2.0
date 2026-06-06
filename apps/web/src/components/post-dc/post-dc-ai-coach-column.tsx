"use client";

import { GraduationCap } from "lucide-react";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { PostDcCallAnalyticsCard } from "@/components/post-dc/post-dc-call-analytics-card";
import { PostLearnedCard, PostScorecardCard } from "@/components/post-dc/post-dc-widget-cards";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import type { PostCallReview } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PostDcAiCoachColumnProps {
  review: PostCallReview;
  className?: string;
}

/** AI Coach tab — call analytics, individual performance, discovery outcomes. */
export function PostDcAiCoachColumn({ review, className }: PostDcAiCoachColumnProps) {
  const hasCoach =
    (review.podScorecard?.length ?? 0) > 0 ||
    (review.openDiscoveryGaps?.length ?? 0) > 0 ||
    review.discoveryBantCoverage !== undefined ||
    (review.learned?.length ?? 0) > 0;

  if (!hasCoach) {
    return (
      <BriefDetailCard title="AI Coach" icon={GraduationCap} className={className}>
        <p className="text-sm text-muted-foreground">
          Coaching scorecards and call analytics appear here after wrap-up completes.
        </p>
      </BriefDetailCard>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <p className="text-sm text-muted-foreground">
        Call analytics, individual pod performance, and discovery outcomes from this session.
      </p>
      <PostDcCallAnalyticsCard review={review} />
      <PostScorecardCard scorecard={review.podScorecard ?? []} />
      {(review.openDiscoveryGaps?.length ?? 0) > 0 || review.discoveryBantCoverage !== undefined ? (
        <PostDiscoveryGapsCard
          gaps={review.openDiscoveryGaps ?? []}
          bantCoverage={review.discoveryBantCoverage}
        />
      ) : null}
      {(review.learned?.length ?? 0) > 0 ? <PostLearnedCard learned={review.learned} /> : null}
    </div>
  );
}
