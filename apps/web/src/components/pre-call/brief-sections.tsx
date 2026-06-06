"use client";

import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { BriefContentToGeneratePanel } from "@/components/pre-call/brief-content-to-generate-panel";
import { BriefPreDeckPanel } from "@/components/pre-call/brief-pre-deck-panel";
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
  const seededChecklist = call ? seedChecklistFromCall(call) : null;

  return (
    <div className="space-y-5">
      {leadershipPreview && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
          Leadership read-only preview — brief updates as the AE prepares.
        </div>
      )}

      <BriefAISummary brief={brief} call={call} />

      <BriefPreDeckPanel
        deck={brief.preDeck}
        callId={brief.callId}
        accountName={brief.accountName}
        industry={call?.industry}
      />

      {brief.researchSections && brief.researchSections.length > 0 && (
        <PreDcResearchCard sections={brief.researchSections} />
      )}

      {brief.postDcPreview && <PostDcBriefPreviewCard preview={brief.postDcPreview} />}

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

      {seededChecklist && (
        <DiscoveryChecklistPanel state={seededChecklist} />
      )}

      <BriefPainsCard pains={brief.pains} />

      {discoveryQuestions.length > 0 && (
        <BriefDiscoveryQuestionsCard questions={discoveryQuestions} />
      )}

      {brief.objections?.length > 0 && <BriefObjectionsCard objections={brief.objections} />}

      <BriefDeckCard
        recommendedDeck={brief.recommendedDeck}
        relevantDocuments={brief.relevantDocuments}
        callId={call?.id}
      />

      <BriefContentToGeneratePanel items={brief.contentToGenerate} />

      {brief.podNotes?.length > 0 && <BriefPodNotesCard notes={brief.podNotes} />}
    </div>
  );
}
