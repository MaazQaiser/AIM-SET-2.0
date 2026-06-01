"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useCall, useCreateJiraTicket, usePostCallReview } from "@/lib/data/hooks";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { AccountSnapshotCard, type AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { EmailEditor } from "@/components/post-dc/email-editor";
import { KbAttachmentCard } from "@/components/post-dc/kb-attachment-card";
import { TaskList } from "@/components/post-dc/crm-task-list";
import { JiraTicketCard } from "@/components/post-dc/jira-ticket-card";
import { PostDiscoveryGapsCard } from "@/components/post-dc/post-discovery-gaps-card";
import {
  PostHeadlineCard,
  PostKbSuggestionsCard,
  PostLearnedCard,
  PostScorecardCard,
  PostSummaryCard,
} from "@/components/post-dc/post-dc-widget-cards";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { sanitizeClientEmailDraft } from "@/lib/post-dc-client-email-safety";
import type {
  PostCallEmailAttachments,
  PostCallEmailAttachmentMissing,
  PostCallJiraTicket,
  PostCallReview,
  PostCallTask,
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
  const { data: review, isLoading: reviewLoading } = usePostCallReview(callId);
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
      : [
          ...(call?.industry ? [{ label: "Industry", value: call.industry }] : []),
          { label: "Deal stage", value: call?.dealStage ?? "Discovery" },
        ];

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

  async function handleCreateJiraTicket(ticket: PostCallJiraTicket) {
    await createJiraTicket.mutateAsync(ticket);
  }

  const hasContent =
    (postRunMeta?.kbSuggestions?.length ?? 0) > 0 ||
    (displayedEmailDraft?.attachments?.found.length ?? 0) > 0 ||
    (displayedEmailDraft?.attachments?.missing.length ?? 0) > 0;

  if (callLoading || reviewLoading) {
    return (
      <div className={shellClass}>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
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
        <>
          <Tabs defaultValue="follow-up" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="follow-up">Emails</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="coaching">Coaching</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

              <TabsContent value="overview" className="m-0 space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.3fr)_1fr]">
                  <AccountSnapshotCard rows={snapshot} />
                  <PostHeadlineCard headline={displayedReview.headline} />
                </div>
              <PostSummaryCard summary={displayedReview.summary ?? []} />
              <div className="grid gap-4 lg:grid-cols-2">
                <PostDiscoveryGapsCard
                  gaps={displayedReview.openDiscoveryGaps ?? []}
                  bantCoverage={displayedReview.discoveryBantCoverage}
                />
                <PostLearnedCard learned={displayedReview.learned ?? []} />
              </div>
              {displayedReview.researchSections?.length ? (
                <PreDcResearchCard
                  sections={displayedReview.researchSections}
                  title="Post-DC import and outcome fields"
                />
              ) : null}
            </TabsContent>

            <TabsContent value="follow-up" className="m-0 space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="space-y-2" aria-label="Client email">
                  <h2 className="text-sm font-semibold text-foreground">Client email</h2>
                  <p className="text-xs text-muted-foreground">
                    MOMs, discussed context, requested attachments, and the next client-facing follow-up.
                  </p>
                  {displayedEmailDraft ? (
                    <EmailEditor
                      draft={displayedEmailDraft}
                      title="Client email"
                      description="Edit the client-facing MOM and attachment note before copying."
                    />
                  ) : (
                    <EmptyState
                      title="No client email draft"
                      description="Run wrap-up after the call to generate a client-facing draft."
                    />
                  )}
                </section>

                <section className="space-y-2" aria-label="Internal team email">
                  <h2 className="text-sm font-semibold text-foreground">Internal team email</h2>
                  <p className="text-xs text-muted-foreground">
                    Team action plan with BANT score details, task owners, and next action items.
                  </p>
                  {displayedInternalEmailDraft ? (
                    <EmailEditor
                      draft={displayedInternalEmailDraft}
                      title="Internal team email"
                      description="Edit the internal handoff before sharing it with the team."
                    />
                  ) : (
                    <EmptyState
                      title="No internal email draft"
                      description="Run wrap-up after the call to generate the internal team action email."
                    />
                  )}
                </section>
              </div>

            </TabsContent>

            <TabsContent value="tasks" className="m-0 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Task list</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Follow-up, internal review, meeting, and content tasks created from the call transcript.
                </p>
              </div>
              <BriefDetailCard title="Task list">
                <TaskList
                  tasks={taskList}
                  onApprove={handleApproveTasks}
                  onReject={handleRejectTask}
                />
              </BriefDetailCard>
              {displayedJiraTicket ? (
                <JiraTicketCard ticket={displayedJiraTicket} onCreate={handleCreateJiraTicket} />
              ) : null}
            </TabsContent>

            <TabsContent value="coaching" className="m-0 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Pod member coaching</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each internal participant's role, performance, talk time, and areas to work from the completed call.
                </p>
              </div>
              {displayedReview.podScorecard?.length ? (
                <PostScorecardCard scorecard={displayedReview.podScorecard ?? []} />
              ) : (
                <EmptyState
                  title="No coaching scorecard yet"
                  description="Pod member performance, talk time, and areas to work appear here after wrap-up."
                />
              )}
            </TabsContent>

            <TabsContent value="content" className="m-0 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Content</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ready KB assets and missing content that should be generated before follow-up.
                </p>
              </div>
              {hasContent ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <PostKbSuggestionsCard suggestions={postRunMeta?.kbSuggestions ?? []} />
                  <AttachmentSummaryCard
                    attachments={displayedEmailDraft?.attachments ?? null}
                    title="Ready content from KB"
                    showMissing={false}
                  />
                  <div className="lg:col-span-2">
                    <MissingContentCard attachments={displayedEmailDraft?.attachments ?? null} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No content suggestions yet"
                  description="Ready assets and generation gaps appear here after wrap-up reviews the transcript."
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function AttachmentSummaryCard({
  attachments,
  title = "Email attachments from KB",
  showMissing = true,
}: {
  attachments: PostCallEmailAttachments | null;
  title?: string;
  showMissing?: boolean;
}) {
  const found = attachments?.found ?? [];
  const missing = attachments?.missing ?? [];

  return (
    <BriefDetailCard title={title}>
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Found in KB</p>
          {found.length > 0 ? (
            <div className="space-y-1.5">
              {found.map((asset) => (
                <KbAttachmentCard key={asset.assetId} asset={asset} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No matching KB assets are ready to attach yet.</p>
          )}
        </div>
        {showMissing ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Need to create before attaching
            </p>
            {missing.length > 0 ? (
              <div className="space-y-1.5">
                {missing.map((asset) => (
                  <MissingContentItem key={asset.name} asset={asset} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No attachment creation needs were flagged.</p>
            )}
          </div>
        ) : null}
      </div>
    </BriefDetailCard>
  );
}

function MissingContentCard({ attachments }: { attachments: PostCallEmailAttachments | null }) {
  const missing = attachments?.missing ?? [];

  return (
    <BriefDetailCard title="Missing content to generate">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Content gaps from the transcript that should be created before adding attachments or sending the next proposal pack.
        </p>
        {missing.length > 0 ? (
          <div className="space-y-1.5">
            {missing.map((asset) => (
              <MissingContentItem key={asset.name} asset={asset} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No missing content was flagged for generation.</p>
        )}
      </div>
    </BriefDetailCard>
  );
}

function MissingContentItem({ asset }: { asset: PostCallEmailAttachmentMissing }) {
  return (
    <a
      href={asset.contentStudioLink}
      className="block rounded-md border border-dashed border-border px-3 py-2 text-xs hover:bg-muted/40"
    >
      <span className="font-medium text-foreground">{asset.name}</span>
      <span className="mt-1 block text-muted-foreground">{asset.requiredData}</span>
      <span className="mt-1 block text-primary">Generate in Content Studio</span>
    </a>
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
