"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useCall, useCallBrief, useCreateJiraTicket, usePostCallReview } from "@/lib/data/hooks";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Badge } from "@dc-copilot/ui/components/badge";
import { LayoutControls } from "@/components/dashboard-grid/layout-controls";
import { POST_DC_WIDGETS } from "@/lib/dashboard/widget-registry";
import { normalizePostDcWidgetProps } from "@/lib/dashboard/normalize-widget-props";
import { PostDcSidebar } from "@/components/post-dc/post-dc-sidebar";
import { PostDcTabbedContent } from "@/components/post-dc/post-dc-tabbed-content";
import { PostDcPageLoader } from "@/components/layout/page-loaders";
import { useLandingPage } from "@/lib/data/clp-hooks";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import { enrichCallBant } from "@/lib/bant/authority-from-lead";
import { buildAccountSnapshot } from "@/lib/dc-data/build-account-snapshot";
import { findPreDcRecordForCall } from "@/lib/dc-notes/build-from-import";
import { preDcField } from "@/types/dc-notes";
import { cn } from "@/lib/cn";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { sanitizeClientEmailDraft } from "@/lib/post-dc-client-email-safety";
import type {
  PostCallJiraTicket,
  PostCallReview,
  PostCallTask,
  PostCallEmailDraft,
} from "@/lib/brief-types";
import type { Call } from "@/types";

const EMPTY_ACCOUNT_SNAPSHOT: AccountSnapshotRow[] = [];
const EMPTY_TASKS: PostCallTask[] = [];
const BANT_TICKET_KEYS = ["budget", "authority", "need", "timeline"] as const;
const JIRA_FINANCIAL_RE =
  /(\$|€|£|\b(?:budget|financial|finance|financing|revenue|roi|pricing|price|cost|investment|unit economics|cfo|economic buyer|board approval|approval path|annual potential|year-one|year one|bant|open discovery gap|open discovery gaps|discovery gaps|discovery coverage)\b)/i;
const JIRA_TIMELINE_RE =
  /\b(?:timeline|pilot|poc|proof of concept|launch|go-live|production|readout|next step|follow up|schedule|meeting|workshop|proposal|by|before|after|q[1-4]|week|month|date|deadline)\b/i;

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
  const { data: landingPage } = useLandingPage(callId);
  const createJiraTicket = useCreateJiraTicket(callId);
  const emailDraft = useDcImportsStore((s) => s.emailDraftsByCallId[callId]);
  const internalEmailDraft = useDcImportsStore((s) => s.internalEmailDraftsByCallId[callId]);
  const taskList = useDcImportsStore((s) => s.crmTasksByCallId[callId] ?? EMPTY_TASKS);
  const jiraTicket = useDcImportsStore((s) => s.jiraTicketsByCallId[callId]);
  const postRunMeta = useDcImportsStore((s) => s.postRunMetaByCallId[callId] ?? null);
  const setPostCallArtifacts = useDcImportsStore((s) => s.setPostCallArtifacts);
  const postDcReady = justWrapped || call?.status === "completed";
  const displayedReview = postDcReady ? (review ?? null) : null;
  const showReview = Boolean(displayedReview);
  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const displayedEmailDraft = sanitizeClientEmailDraft({
    draft: emailDraft
      ? { ...emailDraft, attachments: emailDraft.attachments ?? postRunMeta?.emailAttachments }
      : undefined,
    accountName: call?.accountName ?? callId,
    review: displayedReview,
    attachments: postRunMeta?.emailAttachments,
  }) ?? null;
  const displayedInternalEmailDraft = internalEmailDraft ?? null;
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

  const resolvedBant = enrichCallBant(call?.bant, {
    leadTitle:
      call?.leadTitle ?? (preRecord ? preDcField(preRecord, "prospectPersona") : undefined),
    clientAttendees: brief?.clientAttendees,
  });

  const shellClass = embedded
    ? "p-4 space-y-4"
    : "p-6 space-y-6 max-w-[1400px] mx-auto w-full";

  function handleApproveTasks(ids: string[]) {
    const approved = taskList.map((task) =>
      ids.includes(task.id) ? ({ ...task, status: "created" } satisfies PostCallTask) : task
    );
    setPostCallArtifacts(callId, { crmTasks: approved });
  }

  function handleRejectTask(id: string) {
    setPostCallArtifacts(callId, { crmTasks: taskList.filter((task) => task.id !== id) });
  }

  function handleClientEmailSent(draft: PostCallEmailDraft) {
    const updatedTasks = taskList.map((task) =>
      isFollowUpEmailTask(task)
        ? ({ ...task, status: "created" } satisfies PostCallTask)
        : task
    );
    setPostCallArtifacts(callId, {
      emailDraft: { ...draft, status: "sent" },
      crmTasks: updatedTasks,
    });
  }

  async function handleCreateJiraTicket(ticket: PostCallJiraTicket) {
    await createJiraTicket.mutateAsync(ticket);
  }

  if ((!importsHydrated || callLoading || reviewLoading) && !call) {
    return embedded ? (
      <div className={shellClass}>
        <PostDcPageLoader />
      </div>
    ) : (
      <PostDcPageLoader />
    );
  }

  if (!call) {
    return (
      <div className={embedded ? "p-4" : "p-6 max-w-5xl mx-auto"}>
        <EmptyState title="Call not found" action={{ label: "Back to calls", href: "/calls" }} />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              href={`/calls/${callId}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
              aria-label="Back to call brief"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  Post-DC review
                </h1>
                <Badge variant="secondary" className="text-[10px]">
                  Call wrap-up
                </Badge>
                {call.status === "completed" && (
                  <Badge variant="success" className="text-[10px]">
                    Completed
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {call.accountName}
                {call.leadName ? ` · ${call.leadName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <CallWrapUpActions
              callId={callId}
              hasReview={showReview}
              showLiveLink={false}
              showPostDcLink={false}
              showCreateDeck={false}
              showEndReview={false}
              className="shrink-0"
            />
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Post-DC wrap-up</p>
          <CallWrapUpActions
            callId={callId}
            hasReview={showReview}
            variant="compact"
            showPostDcLink={false}
            showCreateDeck={false}
            showEndReview={false}
          />
        </div>
      )}

      {!displayedReview ? (
        <div className="space-y-4">
          <EmptyState
            icon={FileSpreadsheet}
            title={postDcReady ? "No Post-DC review yet" : "Post-DC starts after wrap-up"}
            description={
              postDcReady
                ? "Run wrap-up to generate a review, or import post_dc_notes_data.csv in Settings for imported accounts."
                : "End and wrap the call from the live cockpit to generate the after-call review."
            }
            action={{
              label: postDcReady ? "Back to brief" : "Open live cockpit",
              href: postDcReady ? `/calls/${callId}` : `/calls/${callId}/live`,
            }}
          />
          {postDcReady && (
            <div className="flex justify-center">
              <CallWrapUpActions
                callId={callId}
                hasReview={false}
                showLiveLink={false}
                showPostDcLink={false}
                showCreateDeck={false}
                endReviewLabel="Run wrap-up"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const widgetProps = normalizePostDcWidgetProps({
              review: displayedReview,
              call,
              callId,
              accountSnapshot: snapshot,
              emailDraft: displayedEmailDraft,
              internalEmailDraft: displayedInternalEmailDraft,
              crmTasks: taskList,
              jiraTicket: displayedJiraTicket,
              kbSuggestions: postRunMeta?.kbSuggestions ?? [],
              emailAttachments: displayedEmailDraft?.attachments,
              landingPage: landingPage ?? null,
              onApproveCrmTasks: handleApproveTasks,
              onRejectCrmTask: handleRejectTask,
              onSendEmailDraft: handleClientEmailSent,
              onCreateJiraTicket: handleCreateJiraTicket,
            });
            return (
              <>
                <LayoutControls layoutKey="post-dc" widgets={POST_DC_WIDGETS} widgetProps={widgetProps} />
                <div
                  className={cn(
                    "grid gap-8",
                    "grid-cols-1",
                    "lg:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]",
                    "lg:items-start"
                  )}
                >
                  <PostDcSidebar
                    accountSnapshot={snapshot}
                    review={displayedReview}
                    bant={resolvedBant}
                  />
                  <div className="min-w-0">
                    <PostDcTabbedContent
                      callId={callId}
                      widgets={POST_DC_WIDGETS}
                      widgetProps={widgetProps}
                      landingPage={landingPage ?? null}
                      jiraTicket={displayedJiraTicket}
                      onCreateJiraTicket={handleCreateJiraTicket}
                      embedded={embedded}
                      defaultTab={embedded ? "summary" : "before"}
                    />
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function isFollowUpEmailTask(task: PostCallTask) {
  return (
    task.task_type === "follow_up" &&
    /(?:follow[-\s]?up email|email draft|send .*email)/i.test(task.description)
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
    issueType: "Review",
    priority: allBantConfirmed || coverage >= 0.75 ? "High" : "Medium",
    labels: ["discovery-call", allBantConfirmed ? "bant-qualified" : "bant-review-needed"],
    projectKey: "SALES",
    bantSnapshot,
  };
}
