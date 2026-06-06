/** Widget ids grouped by Post-DC tab (order preserved within each tab). */
export const POST_DC_TAB_WIDGET_IDS = {
  summary: [
    "post.deal_signals",
    "post.headline",
    "post.summary",
    "post.discovery_gaps",
    "post.next_step_teaser",
  ],
  actions: [
    "post.next_step_proposal",
    "post.task_list",
    "post.email_jira_handoff",
  ],
  transcript: [],
  coaching: ["post.scorecard"],
  before: ["post.before_context", "post.research"],
  content: ["post.kb_suggestions"],
  proposal: [],
  jira: [],
  landing: ["post.clp_analytics"],
} as const;

export type PostDcTabId = keyof typeof POST_DC_TAB_WIDGET_IDS;

export type PostDcTabGroup = "review" | "actions" | "prepared";

export const POST_DC_DEFAULT_TAB: PostDcTabId = "summary";

export const POST_DC_TAB_ITEMS: {
  id: PostDcTabId;
  label: string;
  group: PostDcTabGroup;
}[] = [
  { id: "summary", label: "Summary", group: "review" },
  { id: "actions", label: "Actions", group: "actions" },
  { id: "transcript", label: "Transcript", group: "review" },
  { id: "coaching", label: "Coaching", group: "review" },
  { id: "before", label: "Before", group: "review" },
  { id: "content", label: "Content", group: "prepared" },
  { id: "proposal", label: "Proposal", group: "prepared" },
  { id: "jira", label: "Jira ticket", group: "prepared" },
  { id: "landing", label: "Landing page", group: "prepared" },
];

export const POST_DC_TAB_JOURNEY: Record<PostDcTabId, string> = {
  summary: "What happened on the call — deal signals, summary, and open gaps",
  actions: "Execute follow-up: confirm next step, approve tasks, send emails",
  transcript: "Full record of what was said",
  coaching: "Pod member coaching from the call",
  before: "Context from pre-call research and CRM",
  content: "Suggested and missing content for follow-up",
  proposal: "Review the proposal draft for this account",
  jira: "Jira ticket draft for internal handoff",
  landing: "Customer landing page status and engagement",
};

export const POST_DC_TAB_GROUP_LABELS: Record<PostDcTabGroup, string> = {
  review: "Review",
  actions: "Actions",
  prepared: "Prepared",
};

/** Hide prepared tabs that do not apply to the current lead stage. */
export function visiblePostDcTabs(leadStage?: string) {
  const stage = (leadStage ?? "").trim().toLowerCase();
  const notFit = stage.includes("not a fit");
  const nurture = stage === "nurture";

  return POST_DC_TAB_ITEMS.filter((tab) => {
    if (notFit && (tab.id === "proposal" || tab.id === "landing")) return false;
    if (nurture && tab.id === "proposal") return false;
    return true;
  });
}

export type PostDcMoreItemId =
  | "transcript"
  | "coaching"
  | "content"
  | "proposal"
  | "jira"
  | "landing"
  | "before";

export const POST_DC_MORE_ITEMS: { id: PostDcMoreItemId; label: string }[] = [
  { id: "transcript", label: "Transcript" },
  { id: "coaching", label: "Pod coaching" },
  { id: "content", label: "Content & attachments" },
  { id: "proposal", label: "Proposal" },
  { id: "jira", label: "Jira ticket" },
  { id: "landing", label: "Landing page" },
  { id: "before", label: "Pre-call context" },
];

/** Accordion items in the More panel — filtered by lead stage. */
export function visiblePostDcMoreItems(leadStage?: string) {
  const stage = (leadStage ?? "").trim().toLowerCase();
  const notFit = stage.includes("not a fit");
  const nurture = stage === "nurture";

  return POST_DC_MORE_ITEMS.filter((item) => {
    if (notFit && (item.id === "proposal" || item.id === "landing")) return false;
    if (nurture && item.id === "proposal") return false;
    return true;
  });
}

export function isPostDcProposalVisible(leadStage?: string) {
  return visiblePostDcMoreItems(leadStage).some((item) => item.id === "proposal");
}

export function isPostDcLandingVisible(leadStage?: string) {
  return visiblePostDcMoreItems(leadStage).some((item) => item.id === "landing");
}
