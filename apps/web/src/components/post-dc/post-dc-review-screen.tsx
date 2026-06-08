"use client";

import { useCallback, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useCall, useCallBrief, useCreateJiraTicket, usePostCallReview } from "@/lib/data/hooks";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { CallDetailColumnLayout } from "@/components/calls/call-detail-column-layout";
import { CallDetailStickyHeader } from "@/components/calls/call-detail-sticky-header";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { LayoutControls } from "@/components/dashboard-grid/layout-controls";
import { PageShell } from "@/components/layout/page-shell";
import { PostDcActionStrip } from "@/components/post-dc/post-dc-action-strip";
import { PostDcTasksColumn } from "@/components/post-dc/post-dc-tasks-column";
import {
  PostDcScreenTabs,
  type PostDcScreenTab,
} from "@/components/post-dc/post-dc-screen-tabs";
import { isPostDcLandingVisible } from "@/components/post-dc/post-dc-tab-config";
import { normalizePostDcWidgetProps } from "@/lib/dashboard/normalize-widget-props";
import { POST_DC_WIDGETS } from "@/lib/dashboard/widget-registry";
import { PostDcPageLoader } from "@/components/layout/page-loaders";
import { useEnsureLandingPage } from "@/lib/data/clp-hooks";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import { enrichCallBant } from "@/lib/bant/authority-from-lead";
import { buildAccountSnapshot } from "@/lib/dc-data/build-account-snapshot";
import { findPreDcRecordForCall } from "@/lib/dc-notes/build-from-import";
import { resolvePostCallReview } from "@/lib/dc-data/resolvers";
import { resolveLeadStage } from "@/lib/post-dc/deal-signals";
import {
  buildPostDcWorkflowTasks,
  countWorkflowTasksDone,
  countWorkflowTasksTotal,
  type PostDcWorkflowTaskStatus,
} from "@/lib/post-dc/workflow-tasks";
import { preDcField } from "@/types/dc-notes";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { PostDcCloseDealAction } from "@/components/post-dc/post-dc-close-deal-action";
import { BotChatPanel } from "@/components/bot-chat-panel";
import { briefBodyClass } from "@/components/pre-call/brief-detail-card";
import { sanitizeClientEmailDraft } from "@/lib/post-dc-client-email-safety";
import { cn } from "@/lib/cn";
import {
  buildClientEmailDraftFromReview,
  buildInternalEmailDraftFromReview,
} from "@/lib/post-dc/build-email-drafts-from-review";
import type {
  PostCallJiraTicket,
  PostCallReview,
  PostCallTask,
} from "@/lib/brief-types";
import type { BANTScore, BANTStatus, Call } from "@/types";

const EMPTY_ACCOUNT_SNAPSHOT: AccountSnapshotRow[] = [];
const EMPTY_TASKS: PostCallTask[] = [];
const EMPTY_WORKFLOW_STATUS: Record<string, PostDcWorkflowTaskStatus> = {};
const BANT_TICKET_KEYS = ["budget", "authority", "need", "timeline"] as const;
const JIRA_FINANCIAL_RE =
  /(\$|€|£|\b(?:budget|financial|finance|financing|revenue|roi|pricing|price|cost|investment|unit economics|cfo|economic buyer|board approval|approval path|annual potential|year-one|year one|bant|open discovery gap|open discovery gaps|discovery gaps|discovery coverage)\b)/i;
const JIRA_TIMELINE_RE =
  /\b(?:timeline|pilot|poc|proof of concept|launch|go-live|production|readout|next step|follow up|schedule|meeting|workshop|proposal|by|before|after|q[1-4]|week|month|date|deadline)\b/i;

function normalizeBantStatus(value: unknown): BANTStatus | null {
  const status =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "status" in value
        ? (value as { status?: unknown }).status
        : null;
  if (status === "confirmed" || status === "partial" || status === "unknown") return status;
  return null;
}

function mergePostDcBantStatus(base: BANTScore, review?: PostCallReview | null): BANTScore {
  const score = review?.bantScore as Record<string, unknown> | undefined;
  if (!score) return base;
  return BANT_TICKET_KEYS.reduce<BANTScore>(
    (next, key) => {
      const status = normalizeBantStatus(score[key]);
      return status ? { ...next, [key]: status } : next;
    },
    base
  );
}

interface PostDcReviewScreenProps {
  callId: string;
  /** Shown after user ends call from live workspace */
  justWrapped?: boolean;
  /** Inside live mobile tab — reduced chrome */
  embedded?: boolean;
  accountSnapshot?: AccountSnapshotRow[];
}

export function PostDcReviewScreen({
  callId,
  justWrapped = false,
  embedded = false,
  accountSnapshot = EMPTY_ACCOUNT_SNAPSHOT,
}: PostDcReviewScreenProps) {
  const { data: call, isLoading: callLoading } = useCall(callId);
  const { data: brief } = useCallBrief(callId);
  const { data: review, isLoading: reviewLoading } = usePostCallReview(callId);
  const preRecord = useDcImportsStore((s) =>
    findPreDcRecordForCall(s.preDcRecords, callId, call?.accountName)
  );
  const createJiraTicket = useCreateJiraTicket(callId);
  const emailDraft = useDcImportsStore((s) => s.emailDraftsByCallId[callId]);
  const internalEmailDraft = useDcImportsStore((s) => s.internalEmailDraftsByCallId[callId]);
  const taskList = useDcImportsStore((s) => s.crmTasksByCallId[callId] ?? EMPTY_TASKS);
  const workflowTaskStatus = useDcImportsStore(
    (s) => s.workflowTaskStatusByCallId[callId] ?? EMPTY_WORKFLOW_STATUS
  );
  const setWorkflowTaskStatus = useDcImportsStore((s) => s.setWorkflowTaskStatus);
  const jiraTicket = useDcImportsStore((s) => s.jiraTicketsByCallId[callId]);
  const postRunMeta = useDcImportsStore((s) => s.postRunMetaByCallId[callId] ?? null);
  const setPostCallArtifacts = useDcImportsStore((s) => s.setPostCallArtifacts);
  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const isEditingLayout = useDashboardLayoutStore((s) => s.isEditing);
  const setEditingLayout = useDashboardLayoutStore((s) => s.setEditing);
  const [screenTab, setScreenTab] = useState<PostDcScreenTab>("overview");
  const importedReview = resolvePostCallReview(callId);
  const displayedReview = review ?? importedReview ?? null;
  const landingPrefetchEnabled = displayedReview
    ? isPostDcLandingVisible(resolveLeadStage(displayedReview))
    : false;
  const { page: landingPage } = useEnsureLandingPage(callId, landingPrefetchEnabled);
  const showReview = Boolean(displayedReview);
  const waitingForReview =
    !importsHydrated || callLoading || (reviewLoading && !displayedReview);
  const pipelineClientDraft = sanitizeClientEmailDraft({
    draft: emailDraft
      ? { ...emailDraft, attachments: emailDraft.attachments ?? postRunMeta?.emailAttachments }
      : undefined,
    accountName: call?.accountName ?? callId,
    review: displayedReview,
    attachments: postRunMeta?.emailAttachments,
  }) ?? null;
  const fallbackClientDraft =
    displayedReview && call
      ? buildClientEmailDraftFromReview({
          callId,
          accountName: call.accountName,
          review: displayedReview,
        })
      : null;
  const displayedEmailDraft = pipelineClientDraft ?? fallbackClientDraft ?? null;
  const fallbackInternalDraft =
    displayedReview && call
      ? buildInternalEmailDraftFromReview({
          callId,
          accountName: call.accountName,
          review: displayedReview,
          crmTasks: taskList,
        })
      : null;
  const displayedInternalEmailDraft = internalEmailDraft ?? fallbackInternalDraft ?? null;
  const displayedJiraTicket =
    jiraTicket ??
    buildJiraTicketDraft({
      accountName: call?.accountName ?? callId,
      review: displayedReview,
      tasks: taskList,
      bant: call?.bant,
    });

  const snapshot =
    accountSnapshot.length > 0
      ? accountSnapshot
      : buildAccountSnapshot({ preRecord, call, includePlaceholder: true });

  const resolvedBant = mergePostDcBantStatus(enrichCallBant(call?.bant, {
    leadTitle:
      call?.leadTitle ?? (preRecord ? preDcField(preRecord, "prospectPersona") : undefined),
    clientAttendees: brief?.clientAttendees,
  }), displayedReview);

  function handleApproveTasks(ids: string[]) {
    const approved = taskList.map((task) =>
      ids.includes(task.id) ? ({ ...task, status: "created" } satisfies PostCallTask) : task
    );
    setPostCallArtifacts(callId, { crmTasks: approved });
  }

  function handleRejectTask(id: string) {
    setPostCallArtifacts(callId, { crmTasks: taskList.filter((task) => task.id !== id) });
  }

  async function handleCreateJiraTicket(ticket: PostCallJiraTicket) {
    await createJiraTicket.mutateAsync(ticket);
  }

  const scrollToWidget = useCallback((widgetId: string) => {
    if (widgetId === "post.clp_status" || widgetId === "post.clp_analytics") {
      setScreenTab("client-landing");
      return;
    }
    document.getElementById(`post-dc-widget-${widgetId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  function handleWorkflowTaskStatus(taskId: string, status: PostDcWorkflowTaskStatus) {
    setWorkflowTaskStatus(callId, taskId, status);
  }

  if (waitingForReview && !showReview) {
    return embedded ? (
      <div className="p-4">
        <PostDcPageLoader />
      </div>
    ) : (
      <PostDcPageLoader />
    );
  }

  if (!call) {
    return (
      <PageShell size={embedded ? "default" : "wide"} className={embedded ? "p-4" : undefined}>
        <EmptyState title="Call not found" action={{ label: "Back to calls", href: "/calls" }} />
      </PageShell>
    );
  }

  const scheduleText =
    call.discoveryCallDatePkt && call.discoveryCallTimePkt
      ? `${call.discoveryCallDatePkt} · ${call.discoveryCallTimePkt} PKT`
      : new Date(call.scheduledAt).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

  const emptyState = (
    <EmptyState
      icon={FileSpreadsheet}
      title={
        justWrapped
          ? "Generating Post-DC review…"
          : call.status === "completed"
            ? "No Post-DC review yet"
            : "Post-DC starts after wrap-up"
      }
      description={
        justWrapped
          ? "The wrap-up pipeline is still running. Refresh in a moment if this screen stays empty."
          : call.status === "completed"
            ? "Run wrap-up from the live cockpit to generate a review for this call."
            : "End and wrap the call from the live cockpit to generate the after-call review. Imported Post-DC accounts open here automatically once post_dc_notes_data.csv is linked."
      }
      action={{
        label:
          call.status === "completed" || justWrapped
            ? "Back to brief"
            : "Open live cockpit",
        href:
          call.status === "completed" || justWrapped
            ? `/calls/${callId}`
            : `/calls/${callId}/live`,
      }}
    />
  );

  if (!showReview) {
    if (embedded) {
      return <div className="p-4">{emptyState}</div>;
    }
    return (
      <PageShell size="wide" className="min-h-0 space-y-4 pb-8">
        <CallDetailStickyHeader
          call={call}
          scheduleText={scheduleText}
          showJoinCall={false}
          isEditingLayout={isEditingLayout}
          onToggleLayout={() => setEditingLayout(!isEditingLayout)}
          phase="post-dc"
        />
        {emptyState}
      </PageShell>
    );
  }

  if (!displayedReview) return null;

  const leadStage = resolveLeadStage(displayedReview);
  const workflowTasks = buildPostDcWorkflowTasks({
    review: displayedReview,
    leadStage,
    hasEmailDraft: Boolean(displayedEmailDraft),
    hasJiraTicket: Boolean(displayedJiraTicket),
    landingPage: landingPage ?? null,
    statusOverrides: workflowTaskStatus,
  });
  const workflowTasksDone = countWorkflowTasksDone(workflowTasks);
  const workflowTasksTotal = countWorkflowTasksTotal(workflowTasks);
  const postDcWorkflow = {
    hasNextSteps: workflowTasksTotal > 0,
    workflowTasksTotal,
    workflowTasksDone,
    crmTasksTotal: 0,
    crmTasksDone: 0,
    clientEmailReady: Boolean(displayedEmailDraft),
    internalEmailReady: Boolean(displayedInternalEmailDraft),
  };
  const postDcOpenGaps = displayedReview.openDiscoveryGaps?.map((gap) => gap.toLowerCase()) ?? [];
  const postDcBantCoveragePct =
    displayedReview.discoveryBantCoverage !== undefined
      ? Math.round(displayedReview.discoveryBantCoverage * 100)
      : undefined;
  const floatingCopilot = (
    <BotChatPanel
      callId={callId}
      variant="floating"
      phase="wrapup"
      surface="post_dc"
      accountName={call.accountName}
      brief={brief ?? null}
      openGaps={postDcOpenGaps}
      bantCoveragePct={postDcBantCoveragePct}
      context={{
        screenTab,
        leadStage,
        reviewHeadline: displayedReview.headline,
        nextStepProposal: displayedReview.nextStepProposal,
        workflowTasksTotal: postDcWorkflow.workflowTasksTotal,
        workflowTasksDone: postDcWorkflow.workflowTasksDone,
        clientEmailReady: postDcWorkflow.clientEmailReady,
        internalEmailReady: postDcWorkflow.internalEmailReady,
      }}
      copilotOnly
    />
  );

  const widgetProps = normalizePostDcWidgetProps({
    review: displayedReview,
    call,
    callId,
    accountSnapshot: snapshot,
    bant: resolvedBant,
    emailDraft: displayedEmailDraft,
    internalEmailDraft: displayedInternalEmailDraft,
    crmTasks: taskList,
    jiraTicket: displayedJiraTicket,
    kbSuggestions: postRunMeta?.kbSuggestions ?? [],
    emailAttachments: displayedEmailDraft?.attachments,
    landingPage: landingPage ?? null,
    leadStage,
    workflowTaskStatus,
    onWorkflowTaskStatusChange: handleWorkflowTaskStatus,
    onScrollToWidget: scrollToWidget,
    onOpenEmailDraft: () => scrollToWidget("post.email_jira_handoff"),
    onApproveCrmTasks: handleApproveTasks,
    onRejectCrmTask: handleRejectTask,
    onCreateJiraTicket: handleCreateJiraTicket,
  });

  const layoutBody = (
    <div className={cn(briefBodyClass, "post-dc-body min-w-0 text-foreground/90")}>
      <LayoutControls layoutKey="post-dc" widgets={POST_DC_WIDGETS} widgetProps={widgetProps} />
      {!isEditingLayout ? (
        <PostDcScreenTabs
          value={screenTab}
          onChange={setScreenTab}
          embedded={embedded}
          className="mb-1"
        />
      ) : null}
      <CallDetailColumnLayout
        layoutKey="post-dc"
        widgets={POST_DC_WIDGETS}
        widgetProps={widgetProps}
        contextEmbedded={embedded}
        postDcScreenTab={isEditingLayout ? "overview" : screenTab}
        postDcBrief={brief ?? null}
        tasksColumn={<PostDcTasksColumn widgetProps={widgetProps} embedded={embedded} />}
      />
    </div>
  );

  if (embedded) {
    return (
      <div className="relative min-w-0 space-y-4 p-4 pb-28 post-dc-body">
        <div className="flex flex-col gap-2 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="type-panel-title text-foreground truncate">{call.accountName}</p>
              <p className="type-caption text-muted-foreground">Post-DC wrap-up</p>
            </div>
            <CallWrapUpActions
              callId={callId}
              hasReview={showReview}
              variant="compact"
              showLiveLink={false}
              showPostDcLink={false}
              showCreateDeck={false}
              showEndReview={false}
            />
            <PostDcCloseDealAction callId={callId} />
          </div>
          <PostDcActionStrip {...postDcWorkflow} />
        </div>
        {layoutBody}
        {floatingCopilot}
      </div>
    );
  }

  return (
    <PageShell
      size="wide"
      className={cn("call-detail-page min-h-0 space-y-4 pb-28 post-dc-body", briefBodyClass)}
    >
      <CallDetailStickyHeader
        call={call}
        scheduleText={scheduleText}
        showJoinCall={false}
        isEditingLayout={isEditingLayout}
        onToggleLayout={() => setEditingLayout(!isEditingLayout)}
        phase="post-dc"
        leadStage={leadStage}
        postDcWorkflow={postDcWorkflow}
        trailingActions={
          <CallWrapUpActions
            callId={callId}
            hasReview={showReview}
            variant="compact"
            showLiveLink={false}
            showPostDcLink={false}
            showCreateDeck={false}
            showEndReview={false}
          />
        }
      />
      {layoutBody}
      {floatingCopilot}
    </PageShell>
  );
}

function jiraSafeLine(value: string | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text || JIRA_FINANCIAL_RE.test(text)) return "";
  return text;
}

function jiraSafeLines(values: Array<string | undefined>, limit: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = jiraSafeLine(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function buildJiraTicketDraft({
  accountName,
  review,
  tasks,
  bant,
}: {
  accountName: string;
  review: PostCallReview | null;
  tasks: PostCallTask[];
  bant?: Call["bant"];
}): PostCallJiraTicket | null {
  if (!review && tasks.length === 0) return null;

  const gaps = review?.openDiscoveryGaps ?? [];
  const lowerGaps = gaps.map((gap) => gap.toLowerCase());
  const coverage = review?.discoveryBantCoverage ?? 0;
  const bantSnapshot = Object.fromEntries(
    BANT_TICKET_KEYS.map((key) => {
      const explicitStatus = bant?.[key];
      if (explicitStatus) return [key, explicitStatus === "confirmed"];
      if (lowerGaps.some((gap) => gap.includes(key))) return [key, false];
      return [key, coverage >= 1 && gaps.length === 0];
    })
  ) as PostCallJiraTicket["bantSnapshot"];
  const allBantConfirmed = BANT_TICKET_KEYS.every((key) => bantSnapshot[key]);

  const summaryLines = jiraSafeLines([review?.headline, ...(review?.summary ?? [])], 4);
  const needLines = jiraSafeLines(review?.summary ?? [], 4).filter((line) => !JIRA_TIMELINE_RE.test(line));
  const timelineLines = jiraSafeLines(
    [...(review?.summary ?? []), ...tasks.map((task) => task.description)],
    8
  ).filter((line) => JIRA_TIMELINE_RE.test(line)).slice(0, 4);
  const neededMaterials = jiraSafeLines(
    tasks
      .filter((task) => task.task_type === "content_request")
      .map((task) => task.description),
    4
  );
  const actionItems = jiraSafeLines(tasks.map((task) => task.description), 6);

  return {
    status: "draft_pending_approval",
    summary: `[${allBantConfirmed ? "DC Qualified" : "DC Follow-up"}] ${accountName} opportunity`,
    description: [
      "Client summary:",
      ...(summaryLines.length ? summaryLines.map((line) => `- ${line}`) : [`- ${accountName} post-discovery follow-up.`]),
      "",
      "Client details / needs:",
      ...(needLines.length ? needLines.map((line) => `- ${line}`) : ["- Confirm the client needs captured in the discovery call."]),
      ...(timelineLines.length
        ? ["", "Timeline / POC:", ...timelineLines.map((line) => `- ${line}`)]
        : []),
      ...(neededMaterials.length
        ? ["", "Needed materials:", ...neededMaterials.map((line) => `- ${line}`)]
        : []),
      "",
      "Action items:",
      ...(actionItems.length ? actionItems.map((line) => `- ${line}`) : ["- Assign owner for the next client follow-up."]),
    ].join("\n"),
    issueType: "Task",
    priority: allBantConfirmed || coverage >= 0.75 ? "High" : "Medium",
    labels: ["discovery-call", allBantConfirmed ? "bant-qualified" : "bant-review-needed"],
    projectKey: "SALES",
    bantSnapshot,
  };
}
