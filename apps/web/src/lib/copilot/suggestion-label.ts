const DIRECT_LABELS: Array<[RegExp, string]> = [
  [/single next best discovery question/i, "Next best question"],
  [/concise objection response/i, "Objection response"],
  [/which bant gap is most important/i, "Most important BANT gap"],
  [/call summary export|call summary/i, "Call summary"],
  [/client-safe follow-up email/i, "Client email"],
  [/unresolved risks/i, "Open risks"],
  [/jira handoff/i, "Jira handoff"],
  [/best matching case study/i, "Best case study"],
  [/compare two kb assets|compare assets/i, "Compare assets"],
  [/introduce an asset/i, "Use this asset"],
  [/what needs attention today/i, "Today's priorities"],
  [/which calls are missing briefs/i, "Missing briefs"],
  [/relevant company proof points/i, "Proof points"],
];

export function copilotSuggestionLabel(suggestion: string) {
  const trimmed = suggestion.trim().replace(/\.$/, "");
  const direct = DIRECT_LABELS.find(([pattern]) => pattern.test(trimmed));
  if (direct) return direct[1];

  return trimmed
    .replace(/^ask\s+(for|which|what|to)?\s*/i, "")
    .replace(/^add evidence for:\s*/i, "Evidence gaps: ")
    .replace(/\.$/, "")
    .replace(/^./, (first) => first.toUpperCase());
}

export function uniqueCopilotSuggestionLabels(suggestions: string[], limit = 3) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    const label = copilotSuggestionLabel(suggestion);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length >= limit) break;
  }

  return labels;
}
