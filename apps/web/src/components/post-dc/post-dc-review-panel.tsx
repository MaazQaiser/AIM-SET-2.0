"use client";

import { FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import {
  PostHeadlineCard,
  PostLearnedCard,
  PostScorecardCard,
  PostSummaryCard,
} from "@/components/post-dc/post-dc-widget-cards";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import { usePostCallReview } from "@/lib/data/hooks";
import { Skeleton } from "@/components/ui/skeleton";

export {
  PostHeadlineCard,
  PostLearnedCard,
  PostScorecardCard,
  PostSummaryCard,
} from "@/components/post-dc/post-dc-widget-cards";

interface PostDCReviewPanelProps {
  callId: string;
}

export function PostDCReviewPanel({ callId }: PostDCReviewPanelProps) {
  const { data: review, isLoading } = usePostCallReview(callId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!review) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No Post-DC notes for this call"
        description="Import post_dc_notes_data.csv in Settings (saved to Supabase). Rows link when company or lead names match Pre-DC data."
        action={{ label: "Import CSV", href: "/settings" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PostHeadlineCard headline={review.headline} />

      {review.researchSections && review.researchSections.length > 0 && (
        <PreDcResearchCard sections={review.researchSections} title="Post-DC import (all fields)" />
      )}

      <PostSummaryCard summary={review.summary} />
      <PostScorecardCard scorecard={review.podScorecard} />
      {(review.openDiscoveryGaps?.length || review.discoveryBantCoverage !== undefined) && (
        <PostDiscoveryGapsCard
          gaps={review.openDiscoveryGaps ?? []}
          bantCoverage={review.discoveryBantCoverage}
        />
      )}
      <PostLearnedCard learned={review.learned} />
    </div>
  );
}
