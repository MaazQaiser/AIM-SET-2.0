/** Widget ids grouped by Post-DC tab (order preserved within each tab). */
export const POST_DC_TAB_WIDGET_IDS = {
  outcomes: [
    "post.headline",
    "post.summary",
    "post.learned",
    "post.discovery_gaps",
    "post.scorecard",
    "post.research",
  ],
  "follow-up": [
    "post.email_draft",
    "post.internal_email",
    "post.kb_suggestions",
  ],
  actions: ["post.task_list", "post.jira_ticket"],
  landing: ["post.clp_analytics"],
} as const;

export type PostDcTabId = keyof typeof POST_DC_TAB_WIDGET_IDS;

export const POST_DC_TAB_ITEMS: { id: PostDcTabId; label: string }[] = [
  { id: "outcomes", label: "Outcomes" },
  { id: "follow-up", label: "Follow-up" },
  { id: "actions", label: "Actions" },
  { id: "landing", label: "Landing page" },
];
