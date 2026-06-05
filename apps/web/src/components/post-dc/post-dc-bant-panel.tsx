"use client";

import { BANTScorecard } from "@/components/bant-scorecard";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { Badge } from "@dc-copilot/ui/components/badge";
import type { PostCallReview } from "@/lib/brief-types";
import type { BANTScore } from "@/types";

const LABEL_TO_KEY: Record<string, keyof BANTScore> = {
  Budget: "budget",
  Authority: "authority",
  Need: "need",
  Timeline: "timeline",
};

function evidenceFromLearned(
  learned: PostCallReview["learned"]
): Partial<Record<keyof BANTScore, string>> {
  const out: Partial<Record<keyof BANTScore, string>> = {};
  for (const item of learned ?? []) {
    const key = LABEL_TO_KEY[item.label];
    if (key && item.note && item.note !== "—") {
      out[key] = item.note;
    }
  }
  return out;
}

interface PostDcBantPanelProps {
  bant: BANTScore;
  review: PostCallReview;
}

export function PostDcBantPanel({ bant, review }: PostDcBantPanelProps) {
  const evidence = evidenceFromLearned(review.learned);
  const coverage = review.discoveryBantCoverage;

  return (
    <BriefDetailCard title="BANT score">
      {coverage !== undefined ? (
        <Badge variant="secondary" className="mb-3 text-[10px]">
          BANT coverage at call end: {Math.round(coverage * 100)}%
        </Badge>
      ) : null}
      <BANTScorecard bant={bant} evidenceByDimension={evidence} layout="stack" plain />
    </BriefDetailCard>
  );
}
