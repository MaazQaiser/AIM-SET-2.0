/** Widget ids grouped by Post-DC tab (order preserved within each tab). */
export const POST_DC_TAB_WIDGET_IDS = {
  before: ["post.before_context", "post.research"],
  summary: [
    "post.headline",
    "post.summary",
    "post.learned",
    "post.deal_signals",
    "post.discovery_gaps",
  ],
  "next-steps": ["post.next_step_proposal", "post.task_list"],
  transcript: [],
  coaching: ["post.scorecard"],
  "follow-up": ["post.email_draft", "post.internal_email"],
  content: ["post.kb_suggestions"],
  proposal: [],
  jira: [],
  landing: ["post.clp_analytics"],
} as const;

export type PostDcTabId = keyof typeof POST_DC_TAB_WIDGET_IDS;

export type PostDcTabGroup = "review" | "prepared";

export const POST_DC_TAB_ITEMS: {
  id: PostDcTabId;
  label: string;
  group: PostDcTabGroup;
}[] = [
  { id: "before", label: "Before", group: "review" },
  { id: "summary", label: "Summary", group: "review" },
  { id: "next-steps", label: "Next steps", group: "review" },
  { id: "transcript", label: "Transcript", group: "review" },
  { id: "coaching", label: "Coaching", group: "review" },
  { id: "follow-up", label: "Follow up", group: "prepared" },
  { id: "content", label: "Content", group: "prepared" },
  { id: "proposal", label: "Proposal", group: "prepared" },
  { id: "jira", label: "Jira ticket", group: "prepared" },
  { id: "landing", label: "Landing page", group: "prepared" },
];

export const POST_DC_TAB_JOURNEY: Record<PostDcTabId, string> = {
  before: "Context from pre-call research and CRM",
  summary: "What happened on the call",
  "next-steps": "Recommended actions for you",
  transcript: "Full record of what was said",
  coaching: "Pod member coaching from the call",
  "follow-up": "Drafts ready for your review",
  content: "Suggested and missing content for follow-up",
  proposal: "Review the proposal draft for this account",
  jira: "Jira ticket draft for internal handoff",
  landing: "Customer landing page status and engagement",
};

export const POST_DC_TAB_GROUP_LABELS: Record<PostDcTabGroup, string> = {
  review: "Review",
  prepared: "Prepared",
};
