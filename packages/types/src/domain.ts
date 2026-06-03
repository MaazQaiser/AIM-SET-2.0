/** Domain types for UI surfaces (no mock payloads). */

export type ContentGapStatus = "draft" | "pending-review" | "approved";
export type ContentGapDraftType = "deck" | "one-pager" | "case-study";

export interface ContentGap {
  id: string;
  topic: string;
  sourcedFrom: string;
  callId?: string;
  status: ContentGapStatus;
  draftType: ContentGapDraftType;
}

export interface QuarterlyPattern {
  title: string;
  sampleSize: number;
  confidence: number;
  strength: "high" | "medium" | "low";
}

export interface KbWatchlistItem {
  assetId: string;
  title: string;
  reason: string;
  action: "none" | "deprecate" | "review";
}

export interface CoachingCandidate {
  aeId: string;
  aeName: string;
  pattern: string;
}

export interface CoachingTransparencyMoment {
  quote: string;
  context: string;
}

export interface CoachingTransparency {
  aeName: string;
  managerName: string;
  moments: CoachingTransparencyMoment[];
}

export interface BantSignal {
  id: string;
  label: string;
  timestamp: number;
  dimension: "budget" | "authority" | "need" | "timeline";
  value?: string;
  sentiment?: "positive" | "neutral" | "negative" | string;
  snippet?: string;
}

export interface KeywordDefinition {
  title: string;
  definition: string;
  assetHint?: string;
}

export type KeywordDefinitions = Record<string, KeywordDefinition>;
