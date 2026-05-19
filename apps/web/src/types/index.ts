export type PodRole = "ae" | "se" | "designer";
export type BANTStatus = "confirmed" | "partial" | "unknown";
export type CallStatus = "upcoming" | "live" | "completed" | "no-show";
export type AssetType = "deck" | "case-study" | "one-pager" | "architecture" | "battlecard";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface PodMember {
  id: string;
  name: string;
  role: PodRole;
  avatarUrl?: string;
  initials: string;
}

export interface Call {
  id: string;
  accountName: string;
  leadName?: string;
  leadTitle?: string;
  industry?: string;
  /** From Annual Revenue - PreDC */
  annualRevenue?: string;
  annualRevenueRaw?: string;
  employeeCount?: string;
  icpBucket?: string;
  website?: string;
  companyTypeIcp?: string;
  dealStage?: string;
  /** Raw CSV: Discovery Call Date (PKT) */
  discoveryCallDatePkt?: string;
  /** Raw CSV: Discovery Call Time (PKT) */
  discoveryCallTimePkt?: string;
  scheduledAt: string;
  duration?: number;
  status: CallStatus;
  pod: PodMember[];
  briefReady: boolean;
  bant?: BANTScore;
}

export interface BANTScore {
  budget: BANTStatus;
  authority: BANTStatus;
  need: BANTStatus;
  timeline: BANTStatus;
}

export interface TranscriptEvent {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole?: "customer" | "ae" | "se" | "designer";
  text: string;
  timestamp: number;
  keywords?: string[];
  sentiment?: "positive" | "negative" | "neutral";
  signalType?: "discovery_anchor" | "timeline" | "objection";
}

export interface Citation {
  id: string;
  title: string;
  type: AssetType | "transcript";
  url?: string;
  excerpt?: string;
}

export interface NudgePayload {
  id: string;
  message: string;
  citation: Citation;
  role: PodRole;
  timestamp: number;
  accepted?: boolean;
}

export interface KBAsset {
  id: string;
  title: string;
  type: AssetType;
  tags: string[];
  lastUsed?: string;
  effectivenessScore?: number;
  uploadedAt: string;
  version: number;
}

export interface CoachingInsight {
  id: string;
  aeId: string;
  aeName: string;
  aeInitials: string;
  pattern: string;
  evidenceQuote?: string;
  callId?: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
}
