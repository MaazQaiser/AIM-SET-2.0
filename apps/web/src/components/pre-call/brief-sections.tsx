"use client";

import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { ClientAttendeesCard } from "@/components/pre-call/client-attendees-card";
import { InternalAttendeesCard } from "@/components/pre-call/internal-attendees-card";
import { resolveInternalAttendees } from "@/lib/attendees/build-internal-attendees";
import { ClientHistoryCard } from "@/components/pre-call/client-history-card";
import { PostDcBriefPreviewCard } from "@/components/pre-call/post-dc-brief-preview";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import {
  BriefBANTCard,
  BriefDeckCard,
  BriefDiscoveryQuestionsCard,
  BriefObjectionsCard,
  BriefPainsCard,
  BriefPodNotesCard,
  BriefSignalsCard,
} from "@/components/pre-call/brief-widget-cards";
import { DiscoveryChecklistPanel } from "@/components/live/discovery-checklist-panel";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import type { CallBrief } from "@/lib/brief-types";
import type { BANTScore, Call } from "@/types";

export {
  BriefBANTCard,
  BriefDeckCard,
  BriefDiscoveryQuestionsCard,
  BriefObjectionsCard,
  BriefPainsCard,
  BriefPodNotesCard,
  BriefSignalsCard,
} from "@/components/pre-call/brief-widget-cards";

interface BriefSectionsProps {
  brief: CallBrief;
  bant?: BANTScore;
  discoveryQuestions?: string[];
  leadershipPreview?: boolean;
  call?: Call;
}

export function BriefSections({
  brief,
  bant,
  discoveryQuestions = [],
  leadershipPreview,
  call,
}: BriefSectionsProps) {
  return (
    <div className="space-y-5">
      {leadershipPreview && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
          Leadership read-only preview — brief updates as the AE prepares.
        </div>
      )}

      <BriefAISummary brief={brief} />

      {brief.researchSections && brief.researchSections.length > 0 && (
        <PreDcResearchCard sections={brief.researchSections} />
      )}

      {brief.postDcPreview && <PostDcBriefPreviewCard preview={brief.postDcPreview} />}

      {brief.newSignals?.length > 0 && <BriefSignalsCard signals={brief.newSignals} />}

      <InternalAttendeesCard
        attendees={resolveInternalAttendees(brief.internalAttendees, call)}
      />

      {brief.clientAttendees?.length > 0 && (
        <ClientAttendeesCard attendees={brief.clientAttendees} />
      )}

      {brief.interactionHistory?.length > 0 && (
        <ClientHistoryCard interactions={brief.interactionHistory} />
      )}

      {bant && <BriefBANTCard bant={bant} />}

      {call && seedChecklistFromCall(call) && (
        <DiscoveryChecklistPanel state={seedChecklistFromCall(call)!} />
      )}

      <BriefPainsCard pains={brief.pains} />

      {discoveryQuestions.length > 0 && (
        <BriefDiscoveryQuestionsCard questions={discoveryQuestions} />
      )}

      {brief.objections?.length > 0 && <BriefObjectionsCard objections={brief.objections} />}

      <BriefDeckCard slides={brief.deckSlides} />

      {brief.podNotes?.length > 0 && <BriefPodNotesCard notes={brief.podNotes} />}
    </div>
  );
}
