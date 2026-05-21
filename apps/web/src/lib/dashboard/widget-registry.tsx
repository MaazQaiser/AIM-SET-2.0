"use client";

import type { ReactNode } from "react";
import type { LayoutItem } from "react-grid-layout";
import {
  AccountSnapshotCard,
  CompanyMetricsCard,
  type AccountSnapshotRow,
} from "@/components/calls/account-widget-cards";
import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { ClientAttendeesCard } from "@/components/pre-call/client-attendees-card";
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
import {
  PostHeadlineCard,
  PostLearnedCard,
  PostScorecardCard,
  PostSummaryCard,
} from "@/components/post-dc/post-dc-widget-cards";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import { DiscoveryChecklistPanel } from "@/components/live/discovery-checklist-panel";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";
import type { BANTScore, Call } from "@/types";

type DefaultLayout = Pick<LayoutItem, "x" | "y" | "w" | "h" | "minW" | "minH">;

export interface WidgetSpec<P = unknown> {
  id: string;
  title: string;
  category: "ai" | "client" | "qualification" | "content" | "pod";
  defaultLayout: DefaultLayout;
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
 * Brief tab default layout, in 12-col grid units.
 *
 * Above-fold targets at 1280×800 (header ≈ 200px, row ≈ 40px → ~15 rows visible):
 *   y 0–7   account.snapshot · ai-summary
 *   y 7–13  attendees       · history
 *   y 13–17 bant            · account.metrics
 *
 * Everything else is below the fold and grouped in clean side-by-side pairs
 * or full-width strips. Every row sums to exactly 12 cols.
 */
export const BRIEF_WIDGETS: WidgetSpec<BriefWidgetProps>[] = [
  {
    id: "account.snapshot",
    title: "Account snapshot",
    category: "client",
    defaultLayout: { x: 0, y: 0, w: 4, h: 7, minH: 4 },
    isAvailable: ({ accountSnapshot }) => accountSnapshot.length > 0,
    render: ({ accountSnapshot }) => <AccountSnapshotCard rows={accountSnapshot} />,
  },
  {
    id: "brief.ai-summary",
    title: "AI summary",
    category: "ai",
    defaultLayout: { x: 4, y: 0, w: 8, h: 7, minH: 4 },
    render: ({ brief }) => <BriefAISummary brief={brief} />,
  },
  {
    id: "brief.attendees",
    title: "Client attendees",
    category: "client",
    defaultLayout: { x: 0, y: 7, w: 6, h: 6, minH: 4 },
    isAvailable: ({ brief }) => brief.clientAttendees.length > 0,
    render: ({ brief }) => <ClientAttendeesCard attendees={brief.clientAttendees} />,
  },
  {
    id: "brief.history",
    title: "Interaction history",
    category: "client",
    defaultLayout: { x: 6, y: 7, w: 6, h: 6, minH: 4 },
    isAvailable: ({ brief }) => brief.interactionHistory.length > 0,
    render: ({ brief }) => <ClientHistoryCard interactions={brief.interactionHistory} />,
  },
  {
    id: "brief.bant",
    title: "BANT scorecard",
    category: "qualification",
    defaultLayout: { x: 0, y: 13, w: 6, h: 4, minH: 3 },
    isAvailable: ({ bant }) => Boolean(bant),
    render: ({ bant }) => <BriefBANTCard bant={bant!} />,
  },
  {
    id: "brief.discovery_checklist",
    title: "Discovery checklist (preview)",
    category: "qualification",
    defaultLayout: { x: 6, y: 13, w: 6, h: 5, minH: 4 },
    isAvailable: ({ call }) => Boolean(call),
    render: ({ call }) => (
      <DiscoveryChecklistPanel state={seedChecklistFromCall(call) ?? null} />
    ),
  },
  {
    id: "account.metrics",
    title: "Company metrics",
    category: "client",
    defaultLayout: { x: 6, y: 13, w: 6, h: 4, minH: 3 },
    isAvailable: ({ call }) => Boolean(call.annualRevenue || call.employeeCount || call.icpBucket),
    render: ({ call }) => <CompanyMetricsCard call={call} />,
  },
  {
    id: "brief.signals",
    title: "New signals",
    category: "ai",
    defaultLayout: { x: 0, y: 17, w: 12, h: 3, minH: 2 },
    isAvailable: ({ brief }) => brief.newSignals.length > 0,
    render: ({ brief }) => <BriefSignalsCard signals={brief.newSignals} />,
  },
  {
    id: "brief.pains",
    title: "Hypothesized pains",
    category: "qualification",
    defaultLayout: { x: 0, y: 20, w: 6, h: 5, minH: 3 },
    render: ({ brief }) => <BriefPainsCard pains={brief.pains} />,
  },
  {
    id: "brief.objections",
    title: "Anticipated objections",
    category: "content",
    defaultLayout: { x: 6, y: 20, w: 6, h: 5, minH: 3 },
    isAvailable: ({ brief }) => brief.objections.length > 0,
    render: ({ brief }) => <BriefObjectionsCard objections={brief.objections} />,
  },
  {
    id: "brief.research",
    title: "Pre-DC research",
    category: "content",
    defaultLayout: { x: 0, y: 25, w: 12, h: 6, minH: 3 },
    isAvailable: ({ brief }) => Boolean(brief.researchSections && brief.researchSections.length > 0),
    render: ({ brief }) => <PreDcResearchCard sections={brief.researchSections!} />,
  },
  {
    id: "brief.post-preview",
    title: "Post-DC preview",
    category: "content",
    defaultLayout: { x: 0, y: 31, w: 12, h: 5, minH: 3 },
    isAvailable: ({ brief }) => Boolean(brief.postDcPreview),
    render: ({ brief }) => <PostDcBriefPreviewCard preview={brief.postDcPreview!} />,
  },
  {
    id: "brief.discovery",
    title: "Discovery questions",
    category: "qualification",
    defaultLayout: { x: 0, y: 36, w: 12, h: 4, minH: 3 },
    isAvailable: ({ discoveryQuestions }) => discoveryQuestions.length > 0,
    render: ({ discoveryQuestions }) => <BriefDiscoveryQuestionsCard questions={discoveryQuestions} />,
  },
  {
    id: "brief.deck",
    title: "Recommended deck",
    category: "content",
    defaultLayout: { x: 0, y: 40, w: 6, h: 5, minH: 3 },
    render: ({ brief }) => <BriefDeckCard slides={brief.deckSlides} />,
  },
  {
    id: "brief.pod-notes",
    title: "Pod notes",
    category: "pod",
    defaultLayout: { x: 6, y: 40, w: 6, h: 5, minH: 3 },
    isAvailable: ({ brief }) => brief.podNotes.length > 0,
    render: ({ brief }) => <BriefPodNotesCard notes={brief.podNotes} />,
  },
];

/**
 * Post-DC tab default layout. Above-fold targets:
 *   y 0–3  account.snapshot · headline
 *   y 3–7  account.snapshot · summary · learned
 *   y 7–11 account.metrics  · research
 */
export const POST_DC_WIDGETS: WidgetSpec<PostDcWidgetProps>[] = [
  {
    id: "account.snapshot",
    title: "Account snapshot",
    category: "client",
    defaultLayout: { x: 0, y: 0, w: 4, h: 7, minH: 4 },
    isAvailable: ({ accountSnapshot }) => accountSnapshot.length > 0,
    render: ({ accountSnapshot }) => <AccountSnapshotCard rows={accountSnapshot} />,
  },
  {
    id: "post.headline",
    title: "Headline",
    category: "ai",
    defaultLayout: { x: 4, y: 0, w: 8, h: 3, minH: 2 },
    render: ({ review }) => <PostHeadlineCard headline={review.headline} />,
  },
  {
    id: "post.summary",
    title: "Summary",
    category: "ai",
    defaultLayout: { x: 4, y: 3, w: 4, h: 4, minH: 3 },
    render: ({ review }) => <PostSummaryCard summary={review.summary} />,
  },
  {
    id: "post.learned",
    title: "BANT & learnings",
    category: "qualification",
    defaultLayout: { x: 8, y: 3, w: 4, h: 4, minH: 3 },
    render: ({ review }) => <PostLearnedCard learned={review.learned} />,
  },
  {
    id: "post.discovery_gaps",
    title: "Discovery gaps",
    category: "qualification",
    defaultLayout: { x: 4, y: 7, w: 4, h: 3, minH: 2 },
    isAvailable: ({ review }) =>
      Boolean(
        (review.openDiscoveryGaps && review.openDiscoveryGaps.length > 0) ||
          review.discoveryBantCoverage !== undefined
      ),
    render: ({ review }) => (
      <PostDiscoveryGapsCard
        gaps={review.openDiscoveryGaps ?? []}
        bantCoverage={review.discoveryBantCoverage}
      />
    ),
  },
  {
    id: "account.metrics",
    title: "Company metrics",
    category: "client",
    defaultLayout: { x: 0, y: 7, w: 4, h: 5, minH: 3 },
    isAvailable: ({ call }) => Boolean(call.annualRevenue || call.employeeCount || call.icpBucket),
    render: ({ call }) => <CompanyMetricsCard call={call} />,
  },
  {
    id: "post.research",
    title: "Post-DC import",
    category: "content",
    defaultLayout: { x: 4, y: 7, w: 8, h: 5, minH: 3 },
    isAvailable: ({ review }) => Boolean(review.researchSections && review.researchSections.length > 0),
    render: ({ review }) => (
      <PreDcResearchCard sections={review.researchSections!} title="Post-DC import (all fields)" />
    ),
  },
  {
    id: "post.scorecard",
    title: "Pod scorecard",
    category: "pod",
    defaultLayout: { x: 0, y: 12, w: 12, h: 5, minH: 3 },
    isAvailable: ({ review }) => review.podScorecard.length > 0,
    render: ({ review }) => <PostScorecardCard scorecard={review.podScorecard} />,
  },
];
