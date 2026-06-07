import { checklistDisplayGaps } from "@/lib/live/bant-display";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { CallIntent, TranscriptEvent } from "@/types";

export interface RunningSummaryInput {
  accountName: string;
  leadName?: string;
  intent?: CallIntent | null;
  intentLabel?: string;
  checklist: DiscoveryChecklistState | null;
  transcript: TranscriptEvent[];
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

  const contact = leadName ? `${leadName} at ${accountName}` : accountName;
  lines.push(`Live discovery with ${contact}.`);

  const intentDisplay =
    intent?.display ?? (intent?.label ?? intentLabel)?.replace(/_/g, " ");
  if (intentDisplay) {
    lines.push(`Primary intent: ${intentDisplay}.`);
  }

  if (checklist && typeof checklist.bantCoverage === "number") {
    const bantPct = Math.round(checklist.bantCoverage * 100);
    lines.push(`BANT coverage at ${bantPct}%.`);
    const gaps = checklistDisplayGaps(checklist);
    if (gaps.missing.length > 0) {
      lines.push(`Still to cover: ${gaps.missing.join(", ")}.`);
    }
    if (gaps.partial.length > 0) {
      lines.push(`Partially covered: ${gaps.partial.join(", ")} — ask for specifics.`);
    }
  }

  const lastCustomer = [...transcript].reverse().find((e) => e.speakerRole === "customer");
  if (lastCustomer?.text) {
    lines.push(
      `Most recent customer comment: "${lastCustomer.text.slice(0, 100)}${lastCustomer.text.length > 100 ? "…" : ""}".`
    );
  }

  return lines;
}

export function clampLines(lines: string[], max: number, expanded: boolean): string[] {
  if (expanded || lines.length <= max) return lines;
  return lines.slice(0, max);
}
