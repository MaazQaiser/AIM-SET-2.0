import type { BantSignal } from "@dc-copilot/types";

type BantDimension = BantSignal["dimension"];

interface BantPattern {
  dimension: BantDimension;
  regex: RegExp;
  extractValue?: (match: RegExpMatchArray, text: string) => string | undefined;
}

const BUDGET_AMOUNT =
  /\$?\d[\d,]*\.?\d*\s*(?:k|m|million|thousand|hundred thousand)|(?:hundred|two hundred|three hundred|four hundred|five hundred|six hundred|seven hundred|eight hundred|nine hundred)\s+(?:thousand|k)/i;

const PATTERNS: BantPattern[] = [
  {
    dimension: "budget",
    regex:
      /(?:budget|approved|carved|allocated|set aside|earmarked|funding|invest(?:ment)?)\b.{0,80}(?:\$?\d[\d,]*\.?\d*\s*(?:k|m|million|thousand)|hundred\s+thousand)/i,
    extractValue: (_m, text) => {
      const amount = text.match(BUDGET_AMOUNT);
      return amount?.[0];
    },
  },
  {
    dimension: "budget",
    regex:
      /(?:\$?\d[\d,]*\.?\d*\s*(?:k|m|million|thousand)|hundred\s+thousand).{0,60}(?:budget|approved|year one|annual|for this|allocated)/i,
    extractValue: (_m, text) => {
      const amount = text.match(BUDGET_AMOUNT);
      return amount?.[0];
    },
  },
  {
    dimension: "timeline",
    regex:
      /(?:timeline|deadline|by\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|q[1-4])|go[\s-]*live|launch|pilot|kick[\s-]*off|rollout).{0,80}(?:week|month|quarter|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|\d{4})/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "timeline",
    regex:
      /(?:partner selection|decision|start|begin|target date|ETA|due date)\s+(?:by|in|before|around)\s+.{2,50}/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "timeline",
    regex:
      /(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:day|week|month|quarter|year)s?/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "authority",
    regex:
      /(?:(?:i|we)\s+(?:own|approve|sign off|decide|authorize)|(?:CEO|CFO|CIO|COO|CTO|VP|SVP|EVP|Director|board|finance lead)\s+.{0,30}(?:approve|decision|sign|own))/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "authority",
    regex:
      /(?:approve|decision|sign off|sign-off|authorization).{0,40}(?:CEO|CFO|CIO|COO|CTO|VP|SVP|EVP|Director|board|finance lead)/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "authority",
    regex:
      /(?:i\s+am\s+(?:a\s+|the\s+)?(?:\w+\s+)?(?:CEO|CFO|CIO|COO|CTO|VP|SVP|EVP|Director)|(?:decision\s+maker|final\s+authority|have\s+(?:the\s+)?(?:final\s+)?authority))/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "need",
    regex:
      /(?:need|require|looking for|must have|pain point|challenge|problem|struggle|bottleneck|nightmare|scattered|broken|manual process|zero visibility).{0,60}(?:software|platform|solution|system|tool|automation|integration|team|pod|dedicated)/i,
    extractValue: (m) => m[0],
  },
  {
    dimension: "need",
    regex:
      /(?:software|platform|solution|system|tool|automation|dedicated team|dedicated pod).{0,60}(?:need|require|essential|critical|must|existing|current)/i,
    extractValue: (m) => m[0],
  },
];

export function detectInstantBant(
  text: string,
  speakerRole: string | undefined,
  timestamp: number
): BantSignal[] {
  // Fire for customer, unknown, or missing role — Recall bots may
  // misattribute all speech to the AE.
  const isAe = speakerRole && ["ae", "se", "designer"].includes(speakerRole);
  if (isAe) return [];

  const lower = text.toLowerCase();
  if (lower.length < 10) return [];

  const seen = new Set<BantDimension>();
  const signals: BantSignal[] = [];

  for (const pattern of PATTERNS) {
    if (seen.has(pattern.dimension)) continue;
    const match = text.match(pattern.regex);
    if (!match) continue;

    seen.add(pattern.dimension);
    const value = pattern.extractValue?.(match, text)?.trim();
    const snippet = match[0].trim();
    const label = value
      ? `${pattern.dimension.charAt(0).toUpperCase() + pattern.dimension.slice(1)} signal: ${value}`
      : `${pattern.dimension.charAt(0).toUpperCase() + pattern.dimension.slice(1)} signal: ${snippet.slice(0, 80)}`;

    signals.push({
      id: `instant-${pattern.dimension}-${timestamp}`,
      dimension: pattern.dimension,
      label,
      value,
      snippet,
      timestamp,
    });
  }

  return signals;
}
