"use client";

import type { ReactNode } from "react";
import type { LayoutItem } from "react-grid-layout";
import {
  AccountSnapshotCard,
  CompanyMetricsCard,
  type AccountSnapshotRow,
} from "@/components/calls/account-widget-cards";
import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { BriefDiscoveryArtifactsTabbedPanel } from "@/components/pre-call/brief-discovery-artifacts-tabbed-panel";
import { BriefPreDeckPanel } from "@/components/pre-call/brief-pre-deck-panel";
import { BriefContentToGeneratePanel } from "@/components/pre-call/brief-content-to-generate-panel";
import { ClientAttendeesCard } from "@/components/pre-call/client-attendees-card";
import { InternalAttendeesCard } from "@/components/pre-call/internal-attendees-card";
import { resolveInternalAttendees } from "@/lib/attendees/build-internal-attendees";
import { ClientHistoryCard } from "@/components/pre-call/client-history-card";
import { PostDcBriefPreviewCard } from "@/components/pre-call/post-dc-brief-preview";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import {
  BriefDeckCard,
  BriefDiscoveryQuestionsCard,
  BriefObjectionsCard,
  BriefPainsCard,
  BriefPodNotesCard,
  BriefSdrHandoffSummaryCard,
} from "@/components/pre-call/brief-widget-cards";
import {
  PostBeforeContextCard,
  PostDcContentSuggestionsCard,
  PostScorecardCard,
  PostSummaryCard,
} from "@/components/post-dc/post-dc-widget-cards";
import { PostDcNextStepTasks } from "@/components/post-dc/post-dc-next-step-tasks";
import { PostDcEmailJiraPanel } from "@/components/post-dc/post-dc-email-jira-panel";
import { PostDcTranscriptPanel } from "@/components/post-dc/post-dc-transcript-panel";
import { PostDcClpActivityCard } from "@/components/post-dc/post-dc-clp-activity-card";
import { PostDcClpStatusCard } from "@/components/post-dc/post-dc-clp-status-card";
import {
  isPostDcLandingVisible,
} from "@/components/post-dc/post-dc-tab-config";
import { PostDcDealSignalsBar } from "@/components/post-dc/post-dc-deal-signals-bar";
import { resolveDealSignals, resolveLeadStage } from "@/lib/post-dc/deal-signals";
import type { PostDcWorkflowTaskStatus } from "@/lib/post-dc/workflow-tasks";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import { TaskList } from "@/components/post-dc/crm-task-list";
import { PostDcClpAnalyticsWidget } from "@/components/post-dc/post-dc-clp-analytics-widget";
import type { CustomerLandingPage } from "@dc-copilot/types";
import type {
  CallBrief,
  PostCallEmailDraft,
  PostCallJiraTicket,
  PostCallKbSuggestion,
  PostCallReview,
  PostCallTask,
} from "@/lib/brief-types";
import { arrayLen } from "@/lib/dashboard/normalize-widget-props";
import type { SdrHandoffSummaryItem } from "@/lib/dc-notes/build-from-import";
import type { BANTScore, Call } from "@/types";

type DefaultLayout = Pick<LayoutItem, "x" | "y" | "w" | "h" | "minW" | "minH">;

export type WidgetColumn = "left" | "center" | "right";

export interface WidgetRenderOptions {
  embedded?: boolean;
}

export interface WidgetSpec<P = unknown> {
  id: string;
  title: string;
  category: "ai" | "client" | "qualification" | "content" | "pod";
  column: WidgetColumn;
  sortOrder: number;
  defaultLayout?: DefaultLayout;
  render: (props: P, options?: WidgetRenderOptions) => ReactNode;
  isAvailable?: (props: P) => boolean;
}

/** Pre-DC sidebar: account & research context */
export const BRIEF_INFO_WIDGET_IDS = [
  "account.snapshot",
  "account.metrics",
  "brief.research",
  "brief.internal-attendees",
  "brief.attendees",
  "brief.history",
  "brief.post-preview",
] as const;

export const BRIEF_TASK_WIDGET_IDS = [] as const;

export function isBriefInfoWidget(id: string): boolean {
  return (BRIEF_INFO_WIDGET_IDS as readonly string[]).includes(id);
}

export function isBriefTaskWidget(id: string): boolean {
  return (BRIEF_TASK_WIDGET_IDS as readonly string[]).includes(id);
}

/** Main column: center widgets + right column except left-rail context. */
export function isBriefFocusWidget<P extends { id: string; column: WidgetColumn }>(
  widget: P
): boolean {
  if (isBriefInfoWidget(widget.id) || isBriefTaskWidget(widget.id)) return false;
  return widget.column === "center" || widget.column === "right";
}

export interface BriefWidgetProps {
  brief: CallBrief;
  bant?: BANTScore;
  discoveryQuestions: string[];
  sdrHandoffSummary: SdrHandoffSummaryItem[];
  leadershipPreview: boolean;
  call: Call;
  accountSnapshot: AccountSnapshotRow[];
}

export interface PostDcWidgetProps {
  review: PostCallReview;
  call: Call;
  callId: string;
  accountSnapshot: AccountSnapshotRow[];
  bant?: BANTScore;
  emailDraft?: PostCallEmailDraft | null;
  internalEmailDraft?: PostCallEmailDraft | null;
  crmTasks?: PostCallTask[];
  jiraTicket?: PostCallJiraTicket | null;
  kbSuggestions?: PostCallKbSuggestion[];
  emailAttachments?: PostCallEmailDraft["attachments"];
  onApproveCrmTasks?: (ids: string[]) => void;
  onRejectCrmTask?: (id: string) => void;
  onCreateJiraTicket?: (ticket: PostCallJiraTicket) => Promise<void> | void;
  landingPage?: CustomerLandingPage | null;
  leadStage?: string;
  workflowTaskStatus?: Record<string, PostDcWorkflowTaskStatus>;
  onWorkflowTaskStatusChange?: (taskId: string, status: PostDcWorkflowTaskStatus) => void;
  onScrollToWidget?: (widgetId: string) => void;
  onOpenEmailDraft?: () => void;
}

/** Post-DC left rail: lead overview accordions (account only) */
export const POST_DC_OVERVIEW_WIDGET_IDS = [
  "account.snapshot",
  "account.metrics",
] as const;

/** Rendered in PostDcFocusColumn — not in widget rail */
export const POST_DC_STRUCTURED_WIDGET_IDS = [
  "post.summary",
  "post.bant",
  "post.deal_signals",
  "post.task_list",
  "post.email_jira_handoff",
] as const;

/** Post-DC left rail: reference accordions below BANT */
export const POST_DC_CONTEXT_ACCORDION_WIDGET_IDS = [
  "post.discovery_gaps",
  "post.scorecard",
  "post.transcript",
  "post.before_context",
  "post.research",
] as const;

export const POST_DC_INFO_WIDGET_IDS = [
  ...POST_DC_OVERVIEW_WIDGET_IDS,
  ...POST_DC_CONTEXT_ACCORDION_WIDGET_IDS,
] as const;

export function isPostDcOverviewWidget(id: string): boolean {
  return (POST_DC_OVERVIEW_WIDGET_IDS as readonly string[]).includes(id);
}

export function isPostDcContextAccordionWidget(id: string): boolean {
  return (POST_DC_CONTEXT_ACCORDION_WIDGET_IDS as readonly string[]).includes(id);
}

export function isPostDcInfoWidget(id: string): boolean {
  return (POST_DC_INFO_WIDGET_IDS as readonly string[]).includes(id);
}

export function isPostDcStructuredWidget(id: string): boolean {
  return (POST_DC_STRUCTURED_WIDGET_IDS as readonly string[]).includes(id);
}

/** Main column: center + right widgets except left-rail context. */
export function isPostDcFocusWidget<P extends { id: string; column: WidgetColumn }>(
  widget: P
): boolean {
  if (isPostDcInfoWidget(widget.id)) return false;
  return widget.column === "center" || widget.column === "right";
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
    render: ({ brief, call }) => <BriefAISummary brief={brief} call={call} />,
  },
  {
    id: "brief.pre-deck",
    title: "AI draft deck",
    category: "content",
    column: "center",
    sortOrder: 0.25,
    isAvailable: ({ brief }) => arrayLen(brief.preDeck?.slides) > 0,
    render: ({ brief, call }) => (
      <BriefPreDeckPanel
        deck={brief.preDeck}
        callId={brief.callId}
        accountName={brief.accountName}
        industry={call.industry}
        relevantDocuments={brief.relevantDocuments}
        relevantProjects={brief.relevantProjects}
        recommendedDeck={brief.recommendedDeck}
      />
    ),
  },
  {
    id: "brief.workflow-artifacts",
    title: "Relevant content",
    category: "content",
    column: "center",
    sortOrder: 0.5,
    isAvailable: ({ brief, call }) =>
      arrayLen(brief.artifactPlan) > 0 ||
      arrayLen(brief.artifactFulfillment) > 0 ||
      Boolean(call.id),
    render: ({ brief, call }) => (
      <BriefDiscoveryArtifactsTabbedPanel brief={brief} call={call} />
    ),
  },
  {
    id: "brief.content-to-generate",
    title: "Content to Generate for similar Leads",
    category: "content",
    column: "center",
    sortOrder: 0.75,
    isAvailable: ({ brief }) => arrayLen(brief.contentToGenerate) > 0,
    render: ({ brief }) => <BriefContentToGeneratePanel items={brief.contentToGenerate} />,
  },
  {
    id: "brief.sdr-handoff",
    title: "SDR handoff summary",
    category: "client",
    column: "center",
    sortOrder: 1.9,
    isAvailable: ({ sdrHandoffSummary }) => arrayLen(sdrHandoffSummary) > 0,
    render: ({ sdrHandoffSummary }) => (
      <BriefSdrHandoffSummaryCard items={sdrHandoffSummary ?? []} />
    ),
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
    title: "Best existing deck",
    category: "content",
    column: "center",
    sortOrder: 0.2,
    render: ({ brief, call }) => (
      <BriefDeckCard
        recommendedDeck={brief.recommendedDeck}
        relevantDocuments={brief.relevantDocuments ?? []}
        callId={call.id}
      />
    ),
  },
  {
    id: "brief.relevant-content",
    title: "KB matches",
    category: "content",
    column: "center",
    sortOrder: 3.5,
    isAvailable: () => false,
    render: () => null,
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
    render: ({ accountSnapshot }, opts) => (
      <AccountSnapshotCard rows={accountSnapshot ?? []} embedded={opts?.embedded} />
    ),
  },
  {
    id: "account.metrics",
    title: "Company metrics",
    category: "client",
    column: "left",
    sortOrder: 1,
    isAvailable: ({ call }) => Boolean(call.annualRevenue || call.employeeCount || call.icpBucket),
    render: ({ call }, opts) => <CompanyMetricsCard call={call} embedded={opts?.embedded} />,
  },
  {
    id: "brief.research",
    title: "Lead research",
    category: "content",
    column: "left",
    sortOrder: 2,
    isAvailable: ({ brief }) => arrayLen(brief.researchSections) > 0,
    render: ({ brief }, opts) => (
      <PreDcResearchCard sections={brief.researchSections ?? []} embedded={opts?.embedded} />
    ),
  },
  {
    id: "brief.internal-attendees",
    title: "Internal attendees",
    category: "pod",
    column: "left",
    sortOrder: 3,
    render: ({ brief, call }, opts) => (
      <InternalAttendeesCard
        attendees={resolveInternalAttendees(brief.internalAttendees, call)}
        embedded={opts?.embedded}
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
    render: ({ brief }, opts) => (
      <ClientAttendeesCard attendees={brief.clientAttendees ?? []} embedded={opts?.embedded} />
    ),
  },
  {
    id: "brief.history",
    title: "Interaction history",
    category: "client",
    column: "left",
    sortOrder: 5,
    isAvailable: ({ brief }) => arrayLen(brief.interactionHistory) > 0,
    render: ({ brief }, opts) => (
      <ClientHistoryCard interactions={brief.interactionHistory ?? []} embedded={opts?.embedded} />
    ),
  },
  {
    id: "brief.post-preview",
    title: "Post-DC preview",
    category: "content",
    column: "left",
    sortOrder: 6,
    isAvailable: ({ brief }) => Boolean(brief.postDcPreview),
    render: ({ brief }, opts) =>
      brief.postDcPreview ? (
        <PostDcBriefPreviewCard preview={brief.postDcPreview} embedded={opts?.embedded} />
      ) : null,
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

/** Post-DC: left = context rail · center + right = summary & actions */
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
    id: "post.deal_signals",
    title: "Deal signals",
    category: "qualification",
    column: "center",
    sortOrder: 1,
    isAvailable: () => false,
    render: ({ review }) => {
      const signals = resolveDealSignals(review);
      return (
        <PostDcDealSignalsBar
          signals={signals}
          leadStage={resolveLeadStage(review)}
        />
      );
    },
  },
  {
    id: "post.discovery_gaps",
    title: "Discovery gaps",
    category: "qualification",
    column: "left",
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
    id: "post.scorecard",
    title: "Pod coaching",
    category: "pod",
    column: "left",
    sortOrder: 4,
    isAvailable: ({ review }) => arrayLen(review.podScorecard) > 0,
    render: ({ review }) => <PostScorecardCard scorecard={review.podScorecard ?? []} />,
  },
  {
    id: "post.transcript",
    title: "Transcript",
    category: "content",
    column: "left",
    sortOrder: 5,
    render: ({ callId }) => <PostDcTranscriptPanel callId={callId} />,
  },
  {
    id: "post.before_context",
    title: "Pre-call context",
    category: "content",
    column: "left",
    sortOrder: 6,
    render: ({ callId }) => <PostBeforeContextCard callId={callId} />,
  },
  {
    id: "post.research",
    title: "Post-DC import",
    category: "content",
    column: "left",
    sortOrder: 7,
    isAvailable: ({ review }) => arrayLen(review.researchSections) > 0,
    render: ({ review }) => (
      <PreDcResearchCard sections={review.researchSections ?? []} title="Post-DC import (all fields)" />
    ),
  },
  {
    id: "post.summary",
    title: "Call summary",
    category: "ai",
    column: "center",
    sortOrder: 0,
    isAvailable: () => false,
    render: ({ review }) => <PostSummaryCard summary={review.summary ?? []} />,
  },
  {
    id: "post.next_step_proposal",
    title: "Recommended next steps",
    category: "ai",
    column: "center",
    sortOrder: 1,
    isAvailable: () => false,
    render: ({
      review,
      leadStage,
      emailDraft,
      jiraTicket,
      landingPage,
      workflowTaskStatus = {},
      onWorkflowTaskStatusChange,
      onScrollToWidget,
    }) => (
      <PostDcNextStepTasks
        review={review}
        leadStage={leadStage ?? resolveLeadStage(review)}
        hasEmailDraft={Boolean(emailDraft)}
        hasJiraTicket={Boolean(jiraTicket)}
        landingPage={landingPage}
        taskStatus={workflowTaskStatus}
        onTaskStatusChange={(taskId, status) => onWorkflowTaskStatusChange?.(taskId, status)}
        onScrollToWidget={onScrollToWidget}
      />
    ),
  },
  {
    id: "post.task_list",
    title: "CRM tasks",
    category: "pod",
    column: "right",
    sortOrder: 3,
    isAvailable: () => false,
    render: ({ crmTasks = [], onApproveCrmTasks, onRejectCrmTask, onOpenEmailDraft }) => (
      <TaskList
        tasks={crmTasks}
        onApprove={onApproveCrmTasks}
        onReject={onRejectCrmTask}
        onOpenEmailDraft={onOpenEmailDraft}
      />
    ),
  },
  {
    id: "post.email_jira_handoff",
    title: "Email & Jira handoff",
    category: "pod",
    column: "center",
    sortOrder: 4,
    isAvailable: () => false,
    render: ({ emailDraft, internalEmailDraft, jiraTicket, onCreateJiraTicket }) => (
      <PostDcEmailJiraPanel
        emailDraft={emailDraft}
        internalEmailDraft={internalEmailDraft}
        jiraTicket={jiraTicket}
        onCreateJiraTicket={onCreateJiraTicket}
        parallelCards
      />
    ),
  },
  {
    id: "post.kb_suggestions",
    title: "Content & attachments",
    category: "content",
    column: "center",
    sortOrder: 5,
    isAvailable: ({ kbSuggestions, emailAttachments }) =>
      arrayLen(kbSuggestions) > 0 ||
      arrayLen(emailAttachments?.found) > 0 ||
      arrayLen(emailAttachments?.missing) > 0,
    render: ({ kbSuggestions = [], emailAttachments }) => (
      <PostDcContentSuggestionsCard
        attachments={emailAttachments ?? null}
        kbSuggestions={kbSuggestions}
      />
    ),
  },
  {
    id: "post.clp_status",
    title: "Landing page",
    category: "content",
    column: "center",
    sortOrder: 9,
    isAvailable: ({ review, landingPage }) =>
      isPostDcLandingVisible(resolveLeadStage(review)) && Boolean(landingPage),
    render: ({ callId, landingPage }) => (
      <div className="space-y-4">
        <PostDcClpStatusCard callId={callId} page={landingPage ?? undefined} />
        <PostDcClpActivityCard
          callId={callId}
          enabled={landingPage?.status === "published"}
        />
      </div>
    ),
  },
  {
    id: "post.clp_analytics",
    title: "Landing page analytics",
    category: "content",
    column: "center",
    sortOrder: 10,
    isAvailable: ({ review, landingPage }) =>
      isPostDcLandingVisible(resolveLeadStage(review)) && landingPage?.status === "published",
    render: ({ callId, landingPage }) => (
      <PostDcClpAnalyticsWidget callId={callId} enabled={landingPage?.status === "published"} />
    ),
  },
];
