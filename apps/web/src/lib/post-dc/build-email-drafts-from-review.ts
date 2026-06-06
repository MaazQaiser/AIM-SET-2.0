import type { PostCallEmailDraft, PostCallReview, PostCallTask } from "@/lib/brief-types";

function safeSummaryLines(review: PostCallReview, limit = 4) {
  return (review.summary ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** Client follow-up draft synthesized from Post-DC review when pipeline drafts are missing. */
export function buildClientEmailDraftFromReview({
  callId,
  accountName,
  review,
}: {
  callId: string;
  accountName: string;
  review: PostCallReview;
}): PostCallEmailDraft | null {
  const summary = safeSummaryLines(review);
  const proposal = review.nextStepProposal?.trim();
  if (summary.length === 0 && !proposal) return null;

  const commitments = proposal
    ? proposal
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    id: `client-email-${callId}`,
    audience: "client",
    to: [`team@${accountName.toLowerCase().replace(/[^a-z0-9]+/g, "") || "client"}.com`],
    cc: [],
    subject: `Follow-up: ${accountName} discovery call`,
    body_markdown: [
      "Hi,",
      "",
      `Thank you for the time today — I appreciated the discussion with the ${accountName} team.`,
      "",
      "What we covered:",
      ...(summary.length ? summary.map((line) => `- ${line}`) : ["- We aligned on priorities and next steps from today's session."]),
      "",
      ...(commitments.length
        ? ["Next steps:", ...commitments.map((line) => `- ${line}`), ""]
        : []),
      "Please let me know if you'd like to adjust timing or attendees for the follow-up.",
      "",
      "Best regards,",
    ].join("\n"),
    style_signals: ["client-safe", "follow-up"],
    commitments_referenced: commitments,
    status: "draft_pending_approval",
  };
}

/** Internal handoff draft synthesized from Post-DC review when pipeline drafts are missing. */
export function buildInternalEmailDraftFromReview({
  callId,
  accountName,
  review,
  crmTasks = [],
}: {
  callId: string;
  accountName: string;
  review: PostCallReview;
  crmTasks?: PostCallTask[];
}): PostCallEmailDraft | null {
  const summary = safeSummaryLines(review);
  const proposal = review.nextStepProposal?.trim();
  const gaps = review.openDiscoveryGaps ?? [];
  if (summary.length === 0 && !proposal && gaps.length === 0 && crmTasks.length === 0) return null;

  const bantScore =
    typeof review.discoveryBantCoverage === "number"
      ? `${Math.round(review.discoveryBantCoverage * 100)}%`
      : "Needs review";

  const taskLines = crmTasks.length
    ? crmTasks.slice(0, 8).map((task) => `- [${task.owner || "Pod"}] ${task.description}`)
    : proposal
      ? [`- ${proposal}`]
      : ["- Review the post-call summary and assign next action owners."];

  return {
    id: `internal-email-${callId}`,
    audience: "internal",
    to: ["internal-team@dc-copilot.local"],
    cc: [],
    subject: `Internal Post-DC action plan: ${accountName}`,
    body_markdown: [
      `Internal Post-DC summary for ${accountName}`,
      "",
      `BANT coverage: ${bantScore}`,
      gaps.length ? `Open discovery gaps: ${gaps.join(", ")}` : "Discovery gaps: none currently flagged",
      "",
      "Call summary:",
      ...(summary.length ? summary.map((line) => `- ${line}`) : ["- See imported Post-DC notes for full context."]),
      "",
      "Recommended next steps:",
      ...taskLines,
    ].join("\n"),
    style_signals: ["internal", "action-oriented"],
    commitments_referenced: taskLines.map((line) => line.replace(/^- \[[^\]]+\]\s*/, "- ")),
    status: "draft_pending_approval",
  };
}
