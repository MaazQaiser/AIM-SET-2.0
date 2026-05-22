import type { PreDCRecord } from "./dc-notes";

export type PreDcAgentTrigger = "ingest" | "manual";

/** Input contract for the Pre-DC agent — one Pre-DC CSV row. */
export interface PreDcAgentInput {
  record: PreDCRecord;
  callId: string;
  trigger: PreDcAgentTrigger;
}

export interface PreDcPromptOverrides {
  summary?: string;
  artifact_plan?: string;
  artifact_fulfill?: string;
}

export interface SummaryHighlightRule {
  pattern: string;
  className: string;
  flags?: string;
}
