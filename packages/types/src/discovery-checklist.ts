/** Discovery Checklist Tracker — live DC qualification state */

export type ChecklistItemId =
  | "budget"
  | "authority"
  | "need"
  | "timeline"
  | "success_criteria"
  | "stakeholders"
  | "decision_process"
  | "current_state"
  | "competition"
  | "next_step"
  | "compliance_security"
  | "engagement_fit";

export type ChecklistItemStatus = "pending" | "partial" | "confirmed" | "not_applicable";

export type ChecklistItemTier = "bant" | "secondary";

export interface ChecklistEvidence {
  snippet: string;
  transcriptOffsetSeconds?: number;
  confidence: number;
  value?: string;
  sentiment?: "positive" | "neutral" | "negative" | string;
  speakerRole?: string;
  signalType?: string;
}

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;
  tier: ChecklistItemTier;
  status: ChecklistItemStatus;
  suggestedQuestion?: string;
  evidence: ChecklistEvidence[];
}

export interface DiscoveryChecklistBant {
  budget: "confirmed" | "partial" | "unknown";
  authority: "confirmed" | "partial" | "unknown";
  need: "confirmed" | "partial" | "unknown";
  timeline: "confirmed" | "partial" | "unknown";
}

export interface DiscoveryChecklistState {
  callId: string;
  coverage: number;
  bantCoverage: number;
  bant: DiscoveryChecklistBant;
  items: ChecklistItem[];
  elapsedSeconds: number;
  openGaps: string[];
  updatedAt: string;
}

export interface BantProgression {
  before: DiscoveryChecklistBant;
  after: DiscoveryChecklistBant;
  delta: number;
  isQualifying: boolean;
}

export interface DiscoverySessionSnapshot {
  callId: string;
  checklist: DiscoveryChecklistState;
  bantProgression: BantProgression;
  openGaps: string[];
}
