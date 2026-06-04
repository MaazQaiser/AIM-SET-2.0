/** Widget ids grouped by Post-DC tab (order preserved within each tab). */
export const POST_DC_TAB_WIDGET_IDS = {
  overview: [
    "post.headline",
    "post.summary",
    "post.learned",
    "post.discovery_gaps",
    "post.research",
  ],
  coaching: ["post.scorecard"],
  "follow-up": ["post.email_draft", "post.internal_email"],
  content: ["post.kb_suggestions"],
  proposal: [],
  actions: ["post.task_list"],
  jira: [],
  landing: ["post.clp_analytics"],
} as const;

export type PostDcTabId = keyof typeof POST_DC_TAB_WIDGET_IDS;

export const POST_DC_TAB_ITEMS: { id: PostDcTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "coaching", label: "Coaching" },
  { id: "follow-up", label: "Follow up" },
  { id: "content", label: "Content" },
  { id: "proposal", label: "Proposal" },
  { id: "actions", label: "Actions" },
  { id: "jira", label: "Jira ticket" },
  { id: "landing", label: "Landing page" },
];
