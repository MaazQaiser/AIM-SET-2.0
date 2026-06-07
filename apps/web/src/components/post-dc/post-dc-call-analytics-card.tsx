"use client";

import { BarChart3 } from "lucide-react";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { BriefDetailCard, BriefDetailRow } from "@/components/pre-call/brief-detail-card";
import type { PostCallReview } from "@/lib/brief-types";

interface PostDcCallAnalyticsCardProps {
  review: PostCallReview;
}

/** Call-level analytics — opens the AI Coach section on Lead Overview. */
export function PostDcCallAnalyticsCard({ review }: PostDcCallAnalyticsCardProps) {
  return (
    <BriefDetailCard title="Call analytics" icon={BarChart3}>
      <PostDcCallAnalyticsContent review={review} />
    </BriefDetailCard>
  );
}

export function PostDcCallAnalyticsContent({ review }: PostDcCallAnalyticsCardProps) {
  const scorecard = review.podScorecard ?? [];
  const gaps = review.openDiscoveryGaps ?? [];
  const coverage = review.discoveryBantCoverage;
  const avgScore =
    scorecard.length > 0
      ? scorecard.reduce((sum, row) => sum + (row.score ?? 0), 0) / scorecard.length
      : null;
  const totalTalkSeconds = scorecard.reduce(
    (sum, row) => sum + (typeof row.talkTimeSeconds === "number" ? row.talkTimeSeconds : 0),
    0
  );

  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="BANT coverage" value={formatCoverage(coverage)} />
        <Metric label="Open discovery gaps" value={gaps.length > 0 ? String(gaps.length) : "None"} />
        <Metric label="Avg pod score" value={avgScore !== null ? `${Math.round(avgScore * 100)}%` : "—"} />
        <Metric label="Pod talk time" value={formatTalkTime(totalTalkSeconds, scorecard.length)} />
      </dl>

      {scorecard.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="type-kicker text-muted-foreground">
            Talk time by participant
          </p>
          <ul className="space-y-2">
            {scorecard.map((row) => (
              <li key={row.member}>
                <BriefDetailRow className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ParticipantAvatar
                      name={row.member}
                      kind="internal"
                      initials={row.member.slice(0, 2)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="type-body font-medium text-foreground truncate">{row.member}</p>
                      <p className="type-caption text-muted-foreground truncate">
                        {row.roleInCall || row.role}
                      </p>
                    </div>
                  </div>
                  <p className="type-label text-foreground shrink-0">
                    {row.talkTimeLabel?.trim() ||
                      (typeof row.talkTimeSeconds === "number"
                        ? formatSeconds(row.talkTimeSeconds)
                        : "—")}
                  </p>
                </BriefDetailRow>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <BriefDetailRow className="py-2">
      <dt className="type-kicker text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 type-panel-title text-foreground">{value}</dd>
    </BriefDetailRow>
  );
}

function formatCoverage(coverage: number | undefined) {
  if (coverage === undefined) return "—";
  return `${Math.round(coverage * 100)}%`;
}

function formatTalkTime(totalSeconds: number, participantCount: number) {
  if (participantCount === 0) return "—";
  if (totalSeconds <= 0) return "Not captured";
  return formatSeconds(totalSeconds);
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
