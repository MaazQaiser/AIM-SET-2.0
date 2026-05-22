import type { PreDCRecord } from "./dc-notes";

export type PreDcAgentTrigger = "ingest" | "manual";

/** Input contract for the Pre-DC agent — one Pre-DC CSV row. */
export interface PreDcAgentInput {
  record: PreDCRecord;
  callId: string;
  trigger: PreDcAgentTrigger;
}

export type PlannedArtifactType =
  | "deck"
  | "case_study"
  | "one_pager"
  | "demo_script"
  | "battlecard"
  | "architecture";

export interface PlannedArtifact {
  id: string;
  name: string;
  type: PlannedArtifactType;
  rationale: string;
  priority: number;
}

export type ArtifactFulfillmentStatus = "found" | "partial" | "missing";

export interface ArtifactFulfillment {
  artifactId: string;
  name: string;
  status: ArtifactFulfillmentStatus;
  snippet?: string;
  assetId?: string;
  requiredData?: string;
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
