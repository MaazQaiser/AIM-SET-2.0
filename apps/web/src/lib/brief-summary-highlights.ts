/**
 * Notion-style inline highlights for AI summary prose.
 */

export interface SummaryHighlightRule {
  pattern: RegExp;
  className: string;
}

const RULES: SummaryHighlightRule[] = [
  {
    pattern:
      /\b(budget|revenue|pricing|cost|ROI|investment|\$[\d,.]+[KMB]?|annual revenue)\b/gi,
    className: "rounded px-1 py-0.5 bg-amber-100/90 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
  },
  {
    pattern: /\b(timeline|deadline|Q[1-4]|by (?:end of )?\w+|within \d+ (?:days|weeks|months))\b/gi,
    className: "rounded px-1 py-0.5 bg-blue-100/90 text-blue-950 dark:bg-blue-500/20 dark:text-blue-100",
  },
  {
    pattern:
      /\b(pain|challenge|struggle|friction|bottleneck|inefficien\w*|manual process|legacy)\b/gi,
    className: "rounded px-1 py-0.5 bg-orange-100/90 text-orange-950 dark:bg-orange-500/20 dark:text-orange-100",
  },
  {
    pattern: /\b(competitor|alternative|vendor|switching|incumbent)\b/gi,
    className: "rounded px-1 py-0.5 bg-rose-100/90 text-rose-950 dark:bg-rose-500/20 dark:text-rose-100",
  },
  {
    pattern:
      /\b(opportunity|growth|scale|expansion|priority|strategic|initiative|transformation)\b/gi,
    className: "rounded px-1 py-0.5 bg-emerald-100/90 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100",
  },
  {
    pattern: /\b(authority|decision|stakeholder|executive|CTO|CFO|VP|director|buyer)\b/gi,
    className: "rounded px-1 py-0.5 bg-violet-100/90 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  },
];

type TextPart = { type: "text"; value: string } | { type: "highlight"; value: string; className: string };

function applyRules(text: string, rules: SummaryHighlightRule[]): TextPart[] {
  let parts: TextPart[] = [{ type: "text", value: text }];
  for (const rule of rules) {
    const next: TextPart[] = [];
    for (const part of parts) {
      if (part.type !== "text") {
        next.push(part);
        continue;
      }
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(part.value)) !== null) {
        if (m.index > last) {
          next.push({ type: "text", value: part.value.slice(last, m.index) });
        }
        next.push({ type: "highlight", value: m[0], className: rule.className });
        last = m.index + m[0].length;
      }
      if (last < part.value.length) {
        next.push({ type: "text", value: part.value.slice(last) });
      }
    }
    parts = next.length > 0 ? next : parts;
  }
  return parts;
}

export function parseSummaryHighlights(text: string): TextPart[] {
  return applyRules(text, RULES);
}
