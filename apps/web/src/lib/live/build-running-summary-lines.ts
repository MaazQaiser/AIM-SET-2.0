import { checklistDisplayGaps } from "@/lib/live/bant-display";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { CallIntent, TranscriptEvent } from "@/types";

const CUSTOMER_QUOTE_MAX = 120;

export interface RunningSummaryInput {
  accountName: string;
  leadName?: string;
  intent?: CallIntent | null;
  intentLabel?: string;
  checklist: DiscoveryChecklistState | null;
  transcript: TranscriptEvent[];
}

function compactText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function truncateAtWord(text: string, max = CUSTOMER_QUOTE_MAX): string {
  const compacted = compactText(text);
  if (compacted.length <= max) return compacted;

  const clipped = compacted.slice(0, max).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const wordSafeClip = lastSpace > Math.round(max * 0.65) ? clipped.slice(0, lastSpace) : clipped;
  return `${wordSafeClip}…`;
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function lowerFirstWord(label: string): string {
  const compacted = compactText(label);
  const [firstWord = ""] = compacted.split(/\s+/);
  if (/^[A-Z0-9]{2,}$/.test(firstWord)) return compacted;
  return `${compacted.charAt(0).toLowerCase()}${compacted.slice(1)}`;
}

function gapPhrase(label: string): string {
  const compacted = compactText(label);
  if (compacted.toLowerCase() === "next step") return "the next step";
  return lowerFirstWord(compacted);
}

function intentPhrase(label: string): string {
  const phrase = lowerFirstWord(label);
  if (/\bdeep dive\b/i.test(phrase) && !/^(a|an|the)\s/i.test(phrase)) {
    return `a ${phrase}`;
  }
  return phrase;
}

function latestCommentLine(comment: string): string | null {
  const preview = truncateAtWord(comment);
  if (!preview) return null;
  const terminal = /[.!?…]$/.test(preview) ? "" : ".";
  return `The latest thing they said was: "${preview}"${terminal}`;
}

function missingGapClause(missingGaps: string[]): string | null {
  if (missingGaps.length === 0) return null;
  const missing = humanList(missingGaps.map(gapPhrase));
  return missingGaps.length === 1
    ? `the main open piece is ${missing}`
    : `the open pieces are ${missing}`;
}

function partialGapClause(partialGaps: string[]): string | null {
  if (partialGaps.length === 0) return null;
  const partial = humanList(partialGaps.map(gapPhrase));
  return partialGaps.length === 1
    ? `${partial} is partly there but still needs specifics`
    : `${partial} are partly there but still need specifics`;
}

export function buildRunningSummaryLines({
  accountName,
  leadName,
  intent,
  intentLabel,
  checklist,
  transcript,
}: RunningSummaryInput): string[] {
  const lines: string[] = [];

  if (transcript.length === 0) {
    return lines;
  }

  const contact = leadName ? `${leadName} at ${accountName}` : accountName;
  lines.push(`You're in a live discovery call with ${contact}.`);

  const intentDisplay = compactText(
    intent?.display || (intent?.label ?? intentLabel)?.replace(/_/g, " ") || ""
  );
  if (intentDisplay) {
    lines.push(`The buyer seems focused on ${intentPhrase(intentDisplay)}.`);
  }

  if (checklist && typeof checklist.bantCoverage === "number") {
    const bantPct = Math.round(checklist.bantCoverage * 100);
    const gaps = checklistDisplayGaps(checklist);
    const gapClauses = [missingGapClause(gaps.missing), partialGapClause(gaps.partial)].filter(
      (clause): clause is string => Boolean(clause)
    );
    const gapSummary = gapClauses.length > 0 ? `; ${humanList(gapClauses)}` : " so far";
    lines.push(`You've got about ${bantPct}% BANT coverage${gapSummary}.`);
  }

  const lastCustomer = [...transcript].reverse().find((e) => e.speakerRole === "customer");
  if (lastCustomer?.text) {
    const commentLine = latestCommentLine(lastCustomer.text);
    if (commentLine) lines.push(commentLine);
  }

  return lines;
}

export function clampLines(lines: string[], max: number, expanded: boolean): string[] {
  if (expanded || lines.length <= max) return lines;
  return lines.slice(0, max);
}
