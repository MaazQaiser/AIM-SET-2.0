"use client";

import { briefBodyClass } from "@/components/pre-call/brief-detail-card";
import type { PostCallReview } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PostDcCallAnalyticsRailProps {
  review: PostCallReview;
  className?: string;
}

export function hasCallAnalyticsData(review: PostCallReview) {
  const scorecard = review.podScorecard ?? [];
  const gaps = review.openDiscoveryGaps?.length ?? 0;
  const coverage = review.discoveryBantCoverage;
  const avgScore =
    scorecard.length > 0
      ? scorecard.reduce((sum, row) => sum + (row.score ?? 0), 0) / scorecard.length
      : null;

  return coverage !== undefined || gaps > 0 || avgScore !== null || scorecard.length > 0;
}

/** Compact call analytics metrics — used inside the analytics card in the right rail. */
export function PostDcCallAnalyticsRail({ review, className }: PostDcCallAnalyticsRailProps) {
  if (!hasCallAnalyticsData(review)) return null;

  const scorecard = review.podScorecard ?? [];
  const gaps = review.openDiscoveryGaps?.length ?? 0;
  const coverage = review.discoveryBantCoverage;
  const avgScore =
    scorecard.length > 0
      ? scorecard.reduce((sum, row) => sum + (row.score ?? 0), 0) / scorecard.length
      : null;

  return (
    <dl className={cn("grid grid-cols-2 gap-x-3 gap-y-2", briefBodyClass, className)}>
      <Metric label="BANT coverage" value={formatCoverage(coverage)} />
      <Metric label="Open gaps" value={gaps > 0 ? String(gaps) : "None"} />
      {avgScore !== null ? (
        <Metric label="Avg pod score" value={`${Math.round(avgScore * 100)}%`} />
      ) : null}
      {scorecard.length > 0 ? (
        <Metric label="Participants" value={String(scorecard.length)} />
      ) : null}
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function formatCoverage(coverage: number | undefined) {
  if (coverage === undefined) return "—";
  return `${Math.round(coverage * 100)}%`;
}
