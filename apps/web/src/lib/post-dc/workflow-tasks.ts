import { isPostDcProposalVisible } from "@/components/post-dc/post-dc-tab-config";
import type { PostCallReview } from "@/lib/brief-types";
import type { CustomerLandingPage } from "@dc-copilot/types";
import { isNotFitLeadStage, isNurtureLeadStage } from "@/lib/post-dc/deal-signals";

export type PostDcWorkflowTaskKind =
  | "send_client_email"
  | "create_jira_ticket"
  | "schedule_meeting"
  | "create_landing_page"
  | "build_proposal";

export type PostDcWorkflowTaskStatus = "pending" | "done" | "skipped";

export interface PostDcWorkflowTask {
  id: string;
  kind: PostDcWorkflowTaskKind;
  title: string;
  /** One-line hint — optional, shown only when row is expanded */
  hint?: string;
  /** Full detail — shown on expand or in target widget */
  detail?: string;
  actionLabel: string;
  scrollTarget?: string;
  actionDisabled?: boolean;
  /** Informational rows, e.g. coming-soon features, do not affect checklist progress. */
  countsTowardProgress?: boolean;
  badge?: string;
  status: PostDcWorkflowTaskStatus;
}

export interface BuildPostDcWorkflowTasksInput {
  review: PostCallReview;
  leadStage: string;
  hasEmailDraft: boolean;
  hasJiraTicket: boolean;
  landingPage?: CustomerLandingPage | null;
  statusOverrides?: Record<string, PostDcWorkflowTaskStatus>;
}

const SME_RE =
  /\b(subject matter expert|sme|technical expert|specialist|solution architect|domain expert)\b/i;
const SCHEDULE_RE =
  /\b(schedule|calendar|readout|follow[- ]up call|next meeting|book|sync|workshop|demo|cfo)\b/i;

function withStatus(
  task: Omit<PostDcWorkflowTask, "status">,
  statusOverrides?: Record<string, PostDcWorkflowTaskStatus>
): PostDcWorkflowTask {
  return {
    ...task,
    status: task.countsTowardProgress === false ? "pending" : statusOverrides?.[task.id] ?? "pending",
  };
}

function scheduleKind(nurture: boolean, proposal: string): { title: string; external: boolean } {
  const external =
    !nurture &&
    /\b(client|cfo|stakeholder|prospect|customer|executive|board|readout)\b/i.test(proposal);
  if (external) return { title: "Book client meeting", external: true };
  if (nurture) return { title: "Book nurture touchpoint", external: false };
  return { title: "Book internal sync", external: false };
}

/** Full AI recommendation — shown once, collapsed by default in the UI. */
export function getPostDcRecommendation(review: PostCallReview): string {
  return review.nextStepProposal?.trim() ?? "";
}

/** Compact actionable checklist — no duplicate of the AI recommendation body. */
export function buildPostDcWorkflowTasks({
  review,
  leadStage,
  hasEmailDraft,
  hasJiraTicket,
  landingPage,
  statusOverrides,
}: BuildPostDcWorkflowTasksInput): PostDcWorkflowTask[] {
  const proposal = getPostDcRecommendation(review);
  const notFit = isNotFitLeadStage(leadStage);
  const nurture = isNurtureLeadStage(leadStage);
  const qualified = !notFit && !nurture;
  const tasks: PostDcWorkflowTask[] = [];

  tasks.push(
    withStatus(
      {
        id: "wf-send-client-email",
        kind: "send_client_email",
        title: notFit ? "Send closing email" : "Send follow-up email",
        hint: notFit ? "Stay top of mind for future needs" : "Confirm next steps with the client",
        actionLabel: hasEmailDraft ? "Open draft" : "Review",
        scrollTarget: "post.email_jira_handoff",
      },
      statusOverrides
    )
  );

  if (qualified) {
    tasks.push(
      withStatus(
        {
          id: "wf-create-jira",
          kind: "create_jira_ticket",
          title: "Create Jira handoff",
          hint: "Delivery context and BANT snapshot",
          actionLabel: hasJiraTicket ? "Review" : "Open",
          scrollTarget: "post.email_jira_handoff",
        },
        statusOverrides
      )
    );
  }

  const needsMeeting =
    qualified || nurture || SCHEDULE_RE.test(proposal) || SME_RE.test(proposal);
  if (needsMeeting) {
    const schedule = scheduleKind(nurture, proposal);
    const smeNote = SME_RE.test(proposal)
      ? "Include an SME on the invite if technical depth is needed."
      : undefined;
    tasks.push(
      withStatus(
        {
          id: "wf-schedule-meeting",
          kind: "schedule_meeting",
          title: schedule.title,
          hint: schedule.external ? "Client-facing checkpoint" : "Align pod before next touchpoint",
          detail: smeNote,
          actionLabel: "View tasks",
          scrollTarget: "post.task_list",
        },
        statusOverrides
      )
    );
  }

  if (!notFit) {
    const published = landingPage?.status === "published";
    tasks.push(
      withStatus(
        {
          id: "wf-landing-page",
          kind: "create_landing_page",
          title: published ? "Customer landing page" : "Create landing page",
          hint: "Engagement summary and artifacts",
          actionLabel: published ? "View" : "Open",
          scrollTarget: "post.clp_status",
        },
        statusOverrides
      )
    );
  }

  if (isPostDcProposalVisible(leadStage)) {
    tasks.push(
      withStatus(
        {
          id: "wf-build-proposal",
          kind: "build_proposal",
          title: "Build proposal",
          hint: "Scope and engagement model",
          actionLabel: "Preview",
          actionDisabled: true,
          countsTowardProgress: false,
          badge: "Coming soon",
          scrollTarget: "post.clp_status",
        },
        statusOverrides
      )
    );
  }

  return tasks;
}

export function workflowTasksForProgress(tasks: PostDcWorkflowTask[]): PostDcWorkflowTask[] {
  return tasks.filter((t) => t.countsTowardProgress !== false);
}

export function countWorkflowTasksTotal(tasks: PostDcWorkflowTask[]): number {
  return workflowTasksForProgress(tasks).length;
}

export function countWorkflowTasksDone(tasks: PostDcWorkflowTask[]): number {
  return workflowTasksForProgress(tasks).filter((t) => t.status === "done").length;
}

export function workflowTasksComplete(tasks: PostDcWorkflowTask[]): boolean {
  const countedTasks = workflowTasksForProgress(tasks);
  return countedTasks.length > 0 && countedTasks.every((t) => t.status === "done" || t.status === "skipped");
}
