"use client";

import type { ReactNode } from "react";
import type { LayoutItem } from "react-grid-layout";
import {
  AccountSnapshotCard,
  CompanyMetricsCard,
  type AccountSnapshotRow,
} from "@/components/calls/account-widget-cards";
import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { BriefArtifactsPanel } from "@/components/pre-call/brief-artifacts-panel";
import { BriefPreDeckPanel } from "@/components/pre-call/brief-pre-deck-panel";
import { BriefContentToGeneratePanel } from "@/components/pre-call/brief-content-to-generate-panel";
import { ClientAttendeesCard } from "@/components/pre-call/client-attendees-card";
import { InternalAttendeesCard } from "@/components/pre-call/internal-attendees-card";
import { resolveInternalAttendees } from "@/lib/attendees/build-internal-attendees";
import { ClientHistoryCard } from "@/components/pre-call/client-history-card";
import { PostDcBriefPreviewCard } from "@/components/pre-call/post-dc-brief-preview";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import { BriefRelevantContentLoader } from "@/components/pre-call/brief-relevant-content";
import {
  BriefBANTCard,
  BriefDeckCard,
  BriefDiscoveryQuestionsCard,
  BriefObjectionsCard,
  BriefPainsCard,
  BriefPodNotesCard,
  BriefSignalsCard,
} from "@/components/pre-call/brief-widget-cards";
import {
  PostHeadlineCard,
  PostLearnedCard,
  PostScorecardCard,
  PostSummaryCard,
} from "@/components/post-dc/post-dc-widget-cards";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";
import { arrayLen } from "@/lib/dashboard/normalize-widget-props";
import type { BANTScore, Call } from "@/types";

type DefaultLayout = Pick<LayoutItem, "x" | "y" | "w" | "h" | "minW" | "minH">;

export type WidgetColumn = "left" | "center" | "right";

export interface WidgetSpec<P = unknown> {
  id: string;
  title: string;
  category: "ai" | "client" | "qualification" | "content" | "pod";
  column: WidgetColumn;
  sortOrder: number;
  defaultLayout?: DefaultLayout;
  render: (props: P) => ReactNode;
  isAvailable?: (props: P) => boolean;
}

export interface BriefWidgetProps {
  brief: CallBrief;
  bant?: BANTScore;
  discoveryQuestions: string[];
  leadershipPreview: boolean;
  call: Call;
  accountSnapshot: AccountSnapshotRow[];
}

export interface PostDcWidgetProps {
  review: PostCallReview;
  call: Call;
  accountSnapshot: AccountSnapshotRow[];
}

/**
 * Left = informational context · Center = discuss & pull up · Right = coverage & completion
 */
export const BRIEF_WIDGETS: WidgetSpec<BriefWidgetProps>[] = [
  {
    id: "brief.ai-summary",
    title: "AI summary",
    category: "ai",
    column: "center",
    sortOrder: 0,
    render: ({ brief }) => <BriefAISummary brief={brief} />,
  },
  {
    id: "brief.pre-deck",
    title: "Pre-call deck",
    category: "content",
    column: "center",
    sortOrder: 0.25,
    isAvailable: ({ brief }) => arrayLen(brief.preDeck?.slides) > 0,
    render: ({ brief }) => <BriefPreDeckPanel deck={brief.preDeck} />,
  },
  {
    id: "brief.workflow-artifacts",
    title: "PRE-DC Workflow artifacts",
    category: "content",
    column: "center",
    sortOrder: 0.5,
    isAvailable: ({ brief }) =>
      arrayLen(brief.artifactPlan) > 0 || arrayLen(brief.artifactFulfillment) > 0,
    render: ({ brief }) => <BriefArtifactsPanel brief={brief} />,
  },
  {
    id: "brief.content-to-generate",
    title: "Content to generate",
    category: "content",
    column: "center",
    sortOrder: 0.75,
    isAvailable: ({ brief }) => arrayLen(brief.contentToGenerate) > 0,
    render: ({ brief }) => <BriefContentToGeneratePanel items={brief.contentToGenerate} />,
  },
  {
    id: "brief.signals",
    title: "New signals",
    category: "ai",
    column: "center",
    sortOrder: 1,
    isAvailable: ({ brief }) => arrayLen(brief.newSignals) > 0,
    render: ({ brief }) => <BriefSignalsCard signals={brief.newSignals ?? []} />,
  },
  {
    id: "brief.discovery",
    title: "Discovery questions",
    category: "qualification",
    column: "center",
    sortOrder: 2,
    isAvailable: ({ discoveryQuestions }) => arrayLen(discoveryQuestions) > 0,
    render: ({ discoveryQuestions }) => (
      <BriefDiscoveryQuestionsCard questions={discoveryQuestions ?? []} />
    ),
  },
  {
    id: "brief.deck",
    title: "Recommended deck",
    category: "content",
    column: "center",
    sortOrder: 3,
    render: ({ brief }) => <BriefDeckCard slides={brief.deckSlides ?? []} />,
  },
  {
    id: "brief.relevant-content",
    title: "Relevant content",
    category: "content",
    column: "center",
    sortOrder: 3.5,
    isAvailable: ({ call }) => Boolean(call.id),
    render: ({ brief, call }) => (
      <BriefRelevantContentLoader callId={call.id} brief={brief} />
    ),
  },
  {
    id: "brief.pains",
    title: "Hypothesized pains",
    category: "qualification",
    column: "center",
    sortOrder: 4,
    render: ({ brief }) => <BriefPainsCard pains={brief.pains ?? []} />,
  },
  {
    id: "brief.objections",
    title: "Anticipated objections",
    category: "content",
    column: "center",
    sortOrder: 5,
    isAvailable: ({ brief }) => arrayLen(brief.objections) > 0,
    render: ({ brief }) => <BriefObjectionsCard objections={brief.objections ?? []} />,
  },
  {
    id: "account.snapshot",
    title: "Account snapshot",
    category: "client",
    column: "left",
    sortOrder: 0,
    isAvailable: ({ accountSnapshot }) => arrayLen(accountSnapshot) > 0,
    render: ({ accountSnapshot }) => <AccountSnapshotCard rows={accountSnapshot ?? []} />,
  },
  {
    id: "account.metrics",
    title: "Company metrics",
    category: "client",
    column: "left",
    sortOrder: 1,
    isAvailable: ({ call }) => Boolean(call.annualRevenue || call.employeeCount || call.icpBucket),
    render: ({ call }) => <CompanyMetricsCard call={call} />,
  },
  {
    id: "brief.research",
    title: "Lead research",
    category: "content",
    column: "left",
    sortOrder: 2,
    isAvailable: ({ brief }) => arrayLen(brief.researchSections) > 0,
    render: ({ brief }) => <PreDcResearchCard sections={brief.researchSections ?? []} />,
  },
  {
    id: "brief.internal-attendees",
    title: "Internal attendees",
    category: "pod",
    column: "left",
    sortOrder: 3,
    render: ({ brief, call }) => (
      <InternalAttendeesCard
        attendees={resolveInternalAttendees(brief.internalAttendees, call)}
      />
    ),
  },
  {
    id: "brief.attendees",
    title: "Client attendees",
    category: "client",
    column: "left",
    sortOrder: 4,
    isAvailable: ({ brief }) => arrayLen(brief.clientAttendees) > 0,
    render: ({ brief }) => <ClientAttendeesCard attendees={brief.clientAttendees ?? []} />,
  },
  {
    id: "brief.history",
    title: "Interaction history",
    category: "client",
    column: "left",
    sortOrder: 5,
    isAvailable: ({ brief }) => arrayLen(brief.interactionHistory) > 0,
    render: ({ brief }) => <ClientHistoryCard interactions={brief.interactionHistory ?? []} />,
  },
  {
    id: "brief.post-preview",
    title: "Post-DC preview",
    category: "content",
    column: "left",
    sortOrder: 6,
    isAvailable: ({ brief }) => Boolean(brief.postDcPreview),
    render: ({ brief }) =>
      brief.postDcPreview ? <PostDcBriefPreviewCard preview={brief.postDcPreview} /> : null,
  },
  {
    id: "brief.bant",
    title: "BANT scorecard",
    category: "qualification",
    column: "right",
    sortOrder: 0,
    isAvailable: ({ bant }) => Boolean(bant),
    render: ({ bant, brief, call }) =>
      bant ? <BriefBANTCard bant={bant} brief={brief} call={call} /> : null,
  },
  {
    id: "brief.pod-notes",
    title: "Pod notes",
    category: "pod",
    column: "right",
    sortOrder: 1,
    isAvailable: ({ brief }) => arrayLen(brief.podNotes) > 0,
    render: ({ brief }) => <BriefPodNotesCard notes={brief.podNotes ?? []} />,
  },
];

/** Post-DC: left = account, center = outcomes, right = imports & scorecard */
export const POST_DC_WIDGETS: WidgetSpec<PostDcWidgetProps>[] = [
  {
    id: "account.snapshot",
    title: "Account snapshot",
    category: "client",
    column: "left",
    sortOrder: 0,
    isAvailable: ({ accountSnapshot }) => arrayLen(accountSnapshot) > 0,
    render: ({ accountSnapshot }) => <AccountSnapshotCard rows={accountSnapshot ?? []} />,
  },
  {
    id: "account.metrics",
    title: "Company metrics",
    category: "client",
    column: "left",
    sortOrder: 1,
    isAvailable: ({ call }) => Boolean(call.annualRevenue || call.employeeCount || call.icpBucket),
    render: ({ call }) => <CompanyMetricsCard call={call} />,
  },
  {
    id: "post.headline",
    title: "Headline",
    category: "ai",
    column: "center",
    sortOrder: 0,
    render: ({ review }) => <PostHeadlineCard headline={review.headline} />,
  },
  {
    id: "post.summary",
    title: "Summary",
    category: "ai",
    column: "center",
    sortOrder: 1,
    render: ({ review }) => <PostSummaryCard summary={review.summary ?? []} />,
  },
  {
    id: "post.learned",
    title: "BANT & learnings",
    category: "qualification",
    column: "center",
    sortOrder: 2,
    render: ({ review }) => <PostLearnedCard learned={review.learned ?? []} />,
  },
  {
    id: "post.discovery_gaps",
    title: "Discovery gaps",
    category: "qualification",
    column: "center",
    sortOrder: 3,
    isAvailable: ({ review }) =>
      arrayLen(review.openDiscoveryGaps) > 0 || review.discoveryBantCoverage !== undefined,
    render: ({ review }) => (
      <PostDiscoveryGapsCard
        gaps={review.openDiscoveryGaps ?? []}
        bantCoverage={review.discoveryBantCoverage}
      />
    ),
  },
  {
    id: "post.research",
    title: "Post-DC import",
    category: "content",
    column: "right",
    sortOrder: 0,
    isAvailable: ({ review }) => arrayLen(review.researchSections) > 0,
    render: ({ review }) => (
      <PreDcResearchCard sections={review.researchSections ?? []} title="Post-DC import (all fields)" />
    ),
  },
  {
    id: "post.scorecard",
    title: "Pod scorecard",
    category: "pod",
    column: "right",
    sortOrder: 1,
    isAvailable: ({ review }) => arrayLen(review.podScorecard) > 0,
    render: ({ review }) => <PostScorecardCard scorecard={review.podScorecard ?? []} />,
  },
];
