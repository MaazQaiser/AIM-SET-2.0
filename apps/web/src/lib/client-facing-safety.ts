/** Shared client-safe copy rules for emails, CLP, and proposals. */

export const CLIENT_UNSAFE_TERMS = [
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
  "pod member",
  "is qualifying",
];

export function hasClientUnsafeText(text: string): boolean {
  const lowered = text.toLowerCase();
  return CLIENT_UNSAFE_TERMS.some((term) => lowered.includes(term));
}

export function safeClientLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const lowered = line.toLowerCase();
    return line.trim() && !CLIENT_UNSAFE_TERMS.some((term) => lowered.includes(term));
  });
}

export function sanitizeClientHeadline(value: string, accountName: string): string {
  if (!value.trim() || hasClientUnsafeText(value)) {
    return `Thank you for your time, ${accountName}`;
  }
  return value.trim();
}

export function sanitizeClientBullets(lines: string[], fallback: string[]): string[] {
  const safe = safeClientLines(lines);
  return safe.length ? safe.slice(0, 6) : fallback.slice(0, 6);
}
