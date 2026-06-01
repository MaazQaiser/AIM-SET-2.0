import type { PostCallEmailAttachments, PostCallEmailDraft, PostCallReview } from "@/lib/brief-types";

const CLIENT_UNSAFE_TERMS = [
  "bant",
  "bant coverage",
  "coverage finished",
  "jira",
  "internal",
  "scorecard",
  "coaching",
  "open discovery gap",
  "open discovery gaps",
  "open gaps",
  "discovery gaps",
  "discovery coverage",
  "decision process",
  "agent envelope",
  "trace id",
  "model:",
  "cost:",
  "a few takeaways",
  "takeaways i captured",
  "call centered on discovery",
];

export function hasClientUnsafeEmailText(draft: PostCallEmailDraft | undefined) {
  const text = `${draft?.subject ?? ""}\n${draft?.body_markdown ?? ""}`.toLowerCase();
  return CLIENT_UNSAFE_TERMS.some((term) => text.includes(term));
}

function safeLines(lines: string[]) {
  return lines.filter((line) => {
    const lowered = line.toLowerCase();
    return line.trim() && !CLIENT_UNSAFE_TERMS.some((term) => lowered.includes(term));
  });
}

function isSafeText(value: string) {
  const lowered = value.toLowerCase();
  return !CLIENT_UNSAFE_TERMS.some((term) => lowered.includes(term));
}

export function sanitizeClientEmailDraft({
  draft,
  accountName,
  review,
  attachments,
}: {
  draft: PostCallEmailDraft | undefined;
  accountName: string;
  review?: PostCallReview | null;
  attachments?: PostCallEmailAttachments;
}): PostCallEmailDraft | undefined {
  if (!draft) return undefined;
  const mergedAttachments = draft.attachments ?? attachments;
  if (draft.audience !== "client" && draft.audience) return draft;
  if (!hasClientUnsafeEmailText(draft)) {
    return { ...draft, audience: "client", attachments: mergedAttachments };
  }

  const safeSummary = safeLines(review?.summary ?? []).slice(0, 4);
  const safeCommitments = safeLines(draft.commitments_referenced ?? []).slice(0, 4);
  const readyAttachments = (mergedAttachments?.found ?? [])
    .map((asset) => asset.name)
    .filter(Boolean)
    .slice(0, 4);
  const missingAttachments = (mergedAttachments?.missing ?? [])
    .map((asset) => asset.name)
    .filter(Boolean)
    .slice(0, 4);

  const body = [
    "Hi,",
    "",
    "Thank you for the time today. I appreciated the discussion and the context your team shared.",
    "",
    "What we discussed:",
    ...(safeSummary.length ? safeSummary.map((line) => `- ${line}`) : [`- We discussed ${accountName}'s priorities and the next follow-up materials.`]),
    "",
    "What we committed to:",
    ...(safeCommitments.length ? safeCommitments.map((line) => `- ${line}`) : ["- Share the agreed follow-up materials and coordinate the next touch base."]),
    "",
    "References we are sharing:",
    ...(
      readyAttachments.length || missingAttachments.length
        ? [...readyAttachments, ...missingAttachments].map((name) => `- ${name}`)
        : ["- Relevant reference materials from our knowledge base."]
    ),
    "",
    "Next touch base:",
    "- We will follow up with proposed times and align on the right attendees for the next discussion.",
    "",
    "Looking forward,",
  ].join("\n");

  return {
    ...draft,
    audience: "client",
    subject:
      draft.subject && isSafeText(draft.subject)
        ? draft.subject
        : `Follow-up from our ${accountName} discussion`,
    body_markdown: body,
    commitments_referenced: safeCommitments,
    attachments: mergedAttachments,
  };
}
