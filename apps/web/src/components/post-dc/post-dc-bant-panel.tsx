"use client";

import { BANTScorecard, splitNeedText } from "@/components/bant-scorecard";
import { PostDcExpandableCard } from "@/components/post-dc/post-dc-expandable-card";
import { PostDcModalSection } from "@/components/post-dc/post-dc-modal-section";
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

function needItemsFromReview(
  review: PostCallReview,
  evidence: Partial<Record<keyof BANTScore, string>>
): string[] {
  const items: string[] = [];

  for (const item of review.learned ?? []) {
    if (item.label === "Need" && item.note && item.note !== "—") {
      items.push(...splitNeedText(item.note));
    }
  }

  if (items.length === 0 && evidence.need) {
    items.push(...splitNeedText(evidence.need));
  }

  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

function formatLearnedPct(value: number): number {
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

interface PostDcBantPanelProps {
  bant: BANTScore;
  review: PostCallReview;
}

export function PostDcBantPanel({ bant, review }: PostDcBantPanelProps) {
  const evidence = evidenceFromLearned(review.learned);
  const needItems = needItemsFromReview(review, evidence);
  const coverage = review.discoveryBantCoverage;
  const openGaps = review.openDiscoveryGaps ?? [];

  const coveragePct = coverage !== undefined ? Math.round(coverage * 100) : null;

  return (
    <PostDcExpandableCard
      title="BANT score"
      className="h-full"
      expandLabel="Expand BANT analysis"
      headerExtra={
        coveragePct !== null ? (
          <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
            {coveragePct}% covered
          </Badge>
        ) : null
      }
      modalContent={
        <div className="space-y-6">
          {coveragePct !== null ? (
            <PostDcModalSection
              title="Discovery coverage"
              description="How much of BANT was validated by end of call."
            >
              <div className="space-y-1.5 max-w-md">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">BANT validated</span>
                  <span className="tabular-nums">{coveragePct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>
              </div>
            </PostDcModalSection>
          ) : null}

          <PostDcModalSection
            title="BANT dimensions"
            description="Status and transcript evidence per dimension."
          >
            <BANTScorecard
              bant={bant}
              evidenceByDimension={evidence}
              needItems={needItems}
              layout="split"
              expanded
            />
          </PostDcModalSection>

          {(review.learned ?? []).length > 0 ? (
            <PostDcModalSection title="What we learned on the call">
              <ul className="divide-y divide-border/60">
                {review.learned.map((item) => (
                  <li key={item.label} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      {item.from !== undefined && item.to !== undefined ? (
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                          {formatLearnedPct(item.from)}% → {formatLearnedPct(item.to)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1 break-words">
                      {item.note}
                    </p>
                  </li>
                ))}
              </ul>
            </PostDcModalSection>
          ) : null}

          {openGaps.length > 0 ? (
            <PostDcModalSection
              title="Open discovery gaps"
              description="Areas still unclear — address in follow-up or next call."
            >
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                {openGaps.map((gap) => (
                  <li key={gap} className="leading-relaxed break-words">
                    {gap}
                  </li>
                ))}
              </ul>
            </PostDcModalSection>
          ) : null}
        </div>
      }
    >
      <BANTScorecard
        bant={bant}
        evidenceByDimension={evidence}
        needItems={needItems}
        layout="split"
        dense
        plain
      />
    </PostDcExpandableCard>
  );
}
