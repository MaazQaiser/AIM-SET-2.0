"use client";

import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import {
  PostBeforeContextCard,
  PostHeadlineCard,
} from "@/components/post-dc/post-dc-widget-cards";
import type { PostDcWidgetProps } from "@/lib/dashboard/widget-registry";
import type { CallBrief } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PostDcPreDcColumnProps {
  widgetProps: PostDcWidgetProps;
  brief?: CallBrief | null;
  className?: string;
}

/** Pre-DC tab — research, brief summary, and pre-call context. */
export function PostDcPreDcColumn({ widgetProps, brief, className }: PostDcPreDcColumnProps) {
  const { review, call, callId } = widgetProps;

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <PostBeforeContextCard callId={callId} />
      {review.headline?.trim() ? <PostHeadlineCard headline={review.headline} /> : null}
      {brief ? <BriefAISummary brief={brief} call={call} /> : null}
      {(review.researchSections?.length ?? 0) > 0 ? (
        <PreDcResearchCard
          sections={review.researchSections ?? []}
          title="Post-DC import (all fields)"
        />
      ) : null}
    </div>
  );
}
