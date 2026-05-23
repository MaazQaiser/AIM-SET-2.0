/** Pre/Post-DC brief shapes (UI + API payloads). */

export interface HypothesizedPain {
  text: string;
  confidence: number;
}

export interface AnticipatedObjection {
  objection: string;
  handler: string;
  confidence: number;
}

export interface DeckSlide {
  id: string;
  title: string;
  usedInCalls: number;
  progressedIn: number;
  included: boolean;
}

export type InfluenceLevel =
  | "decision-maker"
  | "influencer"
  | "champion"
  | "blocker"
  | "evaluator";

export type SentimentTrend =
  | "positive"
  | "neutral"
  | "negative"
  | "improving"
  | "declining";

export interface ClientAttendee {
  id: string;
  name: string;
  title: string;
  department: string;
  influenceLevel: InfluenceLevel;
  background: string;
  priorInteractionNote?: string;
  lastContactedAt?: string;
  linkedinUrl?: string;
}

/** Pod members assigned to this call with role context for pre-DC prep. */
export interface InternalAttendee {
  id: string;
  name: string;
  role: "ae" | "se" | "designer";
  designation: string;
  fitReason: string;
  initials: string;
  avatarUrl?: string;
}

export interface ClientInteraction {
  id: string;
  date: string;
  type: "discovery-call" | "demo" | "follow-up" | "email" | "proposal" | "no-show";
  outcome: string;
  keyMoments: string[];
  sentimentTrend: SentimentTrend;
  attendees: string[];
  durationMinutes?: number;
}

export interface BriefResearchSection {
  title: string;
  items: { label: string; value: string }[];
}

export interface PostDcBriefPreview {
  leadStage: string;
  bottomLineContext: string;
  salesStrategy: string;
  engagementModel: string;
  additionalInfo: string;
  bant: { label: string; value: string }[];
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

export type PreDcAgentStatus = "pending" | "running" | "success" | "failed";

export type RelevantDocumentFormat = "pdf" | "ppt" | "pptx";

export type RelevantProjectSource = "knowledge_base" | "project_database" | "dc_notes";

export interface RelevantDocument {
  assetId: string;
  title: string;
  fileName?: string;
  mimeType?: string;
  format: RelevantDocumentFormat;
  relevanceScore: number;
  snippet?: string;
  /** Indexed text from KB (used for in-app PPT preview when slides cannot render). */
  previewText?: string;
}

export interface RelevantProject {
  id: string;
  title: string;
  source: RelevantProjectSource;
  relevanceScore: number;
  summary: string;
  details: string;
  assetId?: string;
}

export interface CallBrief {
  callId: string;
  accountName: string;
  aiSummary: string;
  opportunityValue?: string;
  dealStage: string;
  daysSinceLastContact: number;
  icpMatch: number;
  icpNote?: string;
  newSignals: string[];
  clientAttendees: ClientAttendee[];
  internalAttendees?: InternalAttendee[];
  interactionHistory: ClientInteraction[];
  pains: HypothesizedPain[];
  objections: AnticipatedObjection[];
  deckSlides: DeckSlide[];
  podNotes: { memberName: string; role: string; note: string; reviewedAt?: string }[];
  researchSections?: BriefResearchSection[];
  postDcPreview?: PostDcBriefPreview;
  postDcResearchSections?: BriefResearchSection[];
  artifactPlan?: PlannedArtifact[];
  artifactFulfillment?: ArtifactFulfillment[];
  relevantDocuments?: RelevantDocument[];
  relevantProjects?: RelevantProject[];
  agentStatus?: PreDcAgentStatus;
  agentRunId?: string;
}

export interface PostCallReview {
  headline: string;
  summary: string[];
  researchSections?: BriefResearchSection[];
  podScorecard: {
    member: string;
    role: string;
    score: number;
    label: string;
    strengths: string;
    watch: string;
  }[];
  learned: { label: string; from?: number; to?: number; note: string }[];
  openDiscoveryGaps?: string[];
  discoveryBantCoverage?: number;
}
