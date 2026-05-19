// Shared domain types used by both the web app and future SDK consumers

export type PodRole = "ae" | "se" | "designer";
export type BANTStatus = "confirmed" | "partial" | "unknown";
export type CallStatus = "upcoming" | "live" | "completed" | "no-show";
export type AssetType = "deck" | "case-study" | "one-pager" | "architecture" | "battlecard";

export interface PodMember {
  id: string;
  name: string;
  role: PodRole;
  avatarUrl?: string;
  initials: string;
}

export interface BANTScore {
  budget: BANTStatus;
  authority: BANTStatus;
  need: BANTStatus;
  timeline: BANTStatus;
}

export interface Call {
  id: string;
  accountName: string;
  scheduledAt: string;
  duration?: number;
  status: CallStatus;
  pod: PodMember[];
  briefReady: boolean;
  bant?: BANTScore;
}

export interface TranscriptEvent {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole?: "customer" | PodRole;
  text: string;
  timestamp: number;
  keywords?: string[];
  sentiment?: "positive" | "negative" | "neutral";
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

/** Structured output envelope every agent must produce */
export interface AgentOutput<T = unknown> {
  answer: T;
  citations: Citation[];
  confidence: number;
  agentId: string;
  traceId: string;
  generatedAt: string;
}
