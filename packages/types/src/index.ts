// Shared domain types — single source of truth for web, api-client, and tooling

export type PodRole = "ae" | "se" | "designer";
export type BANTStatus = "confirmed" | "partial" | "unknown";
export type CallStatus = "upcoming" | "live" | "completed" | "no-show";
export type AssetType =
  | "deck"
  | "case-study"
  | "one-pager"
  | "architecture"
  | "battlecard"
  | "image";
export type ConfidenceLevel = "high" | "medium" | "low";

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
  leadName?: string;
  leadTitle?: string;
  industry?: string;
  annualRevenue?: string;
  annualRevenueRaw?: string;
  employeeCount?: string;
  icpBucket?: string;
  website?: string;
  companyTypeIcp?: string;
  dealStage?: string;
  discoveryCallDatePkt?: string;
  discoveryCallTimePkt?: string;
  meetingUrl?: string;
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
  signalType?: string;
}

export type CallIntentLabel =
  | "general_discovery"
  | "commercial_discovery"
  | "technical_deep_dive"
  | "competitive_evaluation"
  | "timeline_planning"
  | "design_exploration"
  | "topic_focus";

export interface CallIntent {
  label: CallIntentLabel | string;
  /** Human-readable intent for live UI */
  display?: string;
  confidence: number;
  evidence?: string;
  signal_type?: string | null;
}

export interface PainSignal {
  id: string;
  text: string;
  source: "brief_match" | "emergent";
  confidence: number;
  timestamp: number;
  evidence?: string;
}

export interface KeywordCount {
  term: string;
  count: number;
}

export interface KeywordStats {
  by_speaker: Record<string, KeywordCount[]>;
  global_top: KeywordCount[];
}

export interface IntentSnapshot {
  intent: CallIntent;
  focus_areas: string[];
  pains: PainSignal[];
  top_keywords: KeywordCount[];
  next_actions?: string[];
}

export interface SentimentShift {
  direction: "negative" | "positive";
  from_score: number;
  to_score: number;
  timestamp: number;
  message: string;
}

export interface SentimentSignal {
  id: string;
  label: string;
  timestamp: number;
  speakerRole: "customer" | PodRole;
  speakerName?: string;
  tone: "positive" | "negative" | "neutral";
  score: number;
  snippet?: string;
}

export interface SalesRepToneCue {
  label: string;
  guidance: string;
  tone: "positive" | "negative" | "neutral";
  source?: string;
}

export interface CustomerSentimentCue {
  label: string;
  guidance: string;
  tone: "positive" | "negative" | "neutral";
  source?: string;
}

export interface LiveSentimentPayload {
  ae: number;
  customer: number;
  shift?: SentimentShift | null;
  signal?: SentimentSignal | null;
  salesRepTone?: SalesRepToneCue | null;
  customerSentiment?: CustomerSentimentCue | null;
}

export interface SurfacedKbAsset {
  id: string;
  title: string;
  excerpt?: string;
  type?: string;
}

export interface ObjectionPayload {
  id: string;
  objection_text: string;
  counter_points: string[];
  suggested_action?: string;
  timestamp: number;
  shownAt?: string;
}

export interface UnansweredQuestionPayload {
  id?: string;
  question_id?: string;
  text: string;
  asked_at_offset?: number;
  seconds_unanswered?: number;
  timestamp?: number;
}

export interface SuggestionLogEntry {
  id?: string;
  operation: string;
  timestamp: number;
  shownAt?: string;
  confidence?: number;
  trace_id?: string;
  summary?: string;
}

export interface Citation {
  id: string;
  title: string;
  type: AssetType | "transcript";
  url?: string;
  excerpt?: string;
}

export type NudgeSource = "live-call" | "discovery-checklist";

export interface NudgePayload {
  id: string;
  message: string;
  citation: Citation;
  role: PodRole;
  timestamp: number;
  accepted?: boolean;
  source?: NudgeSource;
  checklistItemId?: string;
  suggestionId?: string;
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
  status?: "pending" | "processing" | "ready" | "failed";
  fileName?: string;
  mimeType?: string;
  chunkCount?: number;
  ingestError?: string;
  hasPreview?: boolean;
  previewSlideCount?: number;
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

export * from "./kb";
export * from "./domain";
export * from "./dc-notes";
export * from "./agents";
export * from "./brief";
export type {
  PreDcAgentTrigger,
  PreDcAgentInput,
  PreDcPromptOverrides,
  SummaryHighlightRule,
} from "./pre-dc-agent";
export * from "./integrations";
export * from "./content_studio";
export * from "./discovery-checklist";
