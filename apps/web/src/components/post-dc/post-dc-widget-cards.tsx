"use client";

import { Brain, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BriefDetailAccordion,
  BriefDetailCard,
  BriefDetailRow,
} from "@/components/pre-call/brief-detail-card";
import type { PostCallReview } from "@/lib/brief-types";

export function PostHeadlineCard({ headline }: { headline: string }) {
  return (
    <BriefDetailCard title="Headline" icon={Sparkles} variant="highlight">
      <p className="text-sm font-medium text-foreground leading-relaxed break-words">{headline}</p>
    </BriefDetailCard>
  );
}

export function PostSummaryCard({ summary }: { summary: string[] }) {
  return (
    <BriefDetailCard title="Summary" icon={Brain}>
      <ul className="divide-y divide-border">
        {summary.map((p, i) => (
          <li key={i} className="py-2.5 text-sm text-muted-foreground whitespace-pre-wrap break-words first:pt-0 last:pb-0">
            {p}
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function PostScorecardCard({ scorecard }: { scorecard: PostCallReview["podScorecard"] }) {
  if (scorecard.length === 0) return null;

  return (
    <BriefDetailCard title="Pod scorecard" icon={Users} scrollMaxHeight="14rem">
      <ul className="space-y-2">
        {scorecard.map((row) => (
          <li key={row.member}>
            <BriefDetailRow>
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-sm font-medium truncate min-w-0">
                  {row.member}{" "}
                  <span className="text-muted-foreground font-normal">({row.role})</span>
                </span>
                <Badge
                  variant={
                    row.score >= 0.8 ? "success" : row.score >= 0.7 ? "warning" : "secondary"
                  }
                  className="shrink-0"
                >
                  {row.label}
                </Badge>
              </div>
              <p className="text-xs text-foreground break-words mt-1.5">
                <span className="font-medium">Notes:</span> {row.strengths}
              </p>
              {row.watch && (
                <p className="text-xs text-muted-foreground break-words mt-1">
                  <span className="font-medium">Watch:</span> {row.watch}
                </p>
              )}
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function PostLearnedCard({ learned }: { learned: PostCallReview["learned"] }) {
  return (
    <BriefDetailCard title="BANT & learnings">
      <ul className="space-y-2">
        {learned.map((item) => (
          <li key={item.label}>
            <BriefDetailRow>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-1">
                {item.note}
              </p>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}
