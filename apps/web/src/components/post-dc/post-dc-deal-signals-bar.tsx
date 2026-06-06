"use client";

import { Users } from "lucide-react";
import { PostDcExpandableCard } from "@/components/post-dc/post-dc-expandable-card";
import {
  PostDcDealSignalsContent,
  dealSignalsAttendeesLabel,
} from "@/components/post-dc/post-dc-deal-signals-content";
import { PostDcModalSection } from "@/components/post-dc/post-dc-modal-section";
import type { PostDcDealSignals } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PostDcDealSignalsBarProps {
  signals: PostDcDealSignals;
  leadStage: string;
  className?: string;
}

function formatAttendees(raw?: string): string {
  if (!raw?.trim()) return "";
  return raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function hasSignalContent(signals: PostDcDealSignals, leadStage: string): boolean {
  return Boolean(
    signals.leadStage ||
      signals.engagementModel ||
      signals.accountsAnnualPotential ||
      signals.serviceLine ||
      signals.icpBucketCorrect ||
      signals.reasonNotFit ||
      signals.attendees ||
      leadStage
  );
}

export function PostDcDealSignalsBar({
  signals,
  leadStage,
  className,
}: PostDcDealSignalsBarProps) {
  if (!hasSignalContent(signals, leadStage)) return null;

  const attendeesShort = dealSignalsAttendeesLabel(signals);
  const attendeesFull = formatAttendees(signals.attendees);

  return (
    <PostDcExpandableCard
      title="Deal signals"
      className={cn("h-full border-border/80", className)}
      expandLabel="Expand deal signals"
      modalDescription={
        attendeesFull ? (
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>{attendeesFull}</span>
          </span>
        ) : undefined
      }
      headerExtra={
        attendeesShort ? (
          <span
            className="inline-flex items-center gap-1 max-w-[160px] text-[10px] text-muted-foreground truncate"
            title={attendeesFull ?? undefined}
          >
            <Users className="h-3 w-3 shrink-0" />
            {attendeesShort}
          </span>
        ) : null
      }
      modalContent={
        <PostDcModalSection
          title="Deal qualification"
          description="Stage, potential, engagement model, and fit signals from the discovery call."
        >
          <PostDcDealSignalsContent
            signals={signals}
            leadStage={leadStage}
            expanded
            showAttendees={Boolean(attendeesFull)}
          />
        </PostDcModalSection>
      }
    >
      <PostDcDealSignalsContent signals={signals} leadStage={leadStage} expanded={false} />
    </PostDcExpandableCard>
  );
}
