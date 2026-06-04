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

export interface PreDeckSlide {
  id: string;
  title: string;
  narrative: string;
  sourceType: "workflow" | "knowledge_base";
  assetId?: string;
  previewText?: string;
}

export interface PreDeck {
  title: string;
  status: "ready" | "needs_content";
  summary: string;
  slides: PreDeckSlide[];
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

export interface BriefSummarySection {
  id: "customer_profile" | "customer_pain_points" | "suggested_action" | "relevance";
  title: string;
  content: string;
}

/** Canonical UI labels for Pre-DC summary sections (single source of truth). */
export const SUMMARY_SECTION_TITLES: Record<BriefSummarySection["id"], string> = {
  customer_profile: "Profile Summary",
  customer_pain_points: "Pain Points",
  suggested_action: "Suggested Action",
  relevance: "Relevance",
};

export const SUMMARY_SECTION_ORDER: readonly BriefSummarySection["id"][] = [
  "customer_profile",
  "customer_pain_points",
  "suggested_action",
  "relevance",
];

/** Rewrite section titles so cached/LLM payloads always match current labels. */
export function normalizeSummarySections(
  sections: BriefSummarySection[] | undefined | null
): BriefSummarySection[] | undefined {
  if (!sections?.length) return sections ?? undefined;
  return sections.map((section) => {
    const title = SUMMARY_SECTION_TITLES[section.id];
    return title ? { ...section, title } : section;
  });
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

export interface ContentToGenerate {
  id: string;
  sourceArtifactId?: string;
  name: string;
  type: PlannedArtifactType;
  priority: number;
  status: "missing" | "partial";
  reason: string;
  neededFor: string;
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
  summarySections?: BriefSummarySection[];
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
  preDeck?: PreDeck;
  podNotes: { memberName: string; role: string; note: string; reviewedAt?: string }[];
  researchSections?: BriefResearchSection[];
  postDcPreview?: PostDcBriefPreview;
  postDcResearchSections?: BriefResearchSection[];
  artifactPlan?: PlannedArtifact[];
  artifactFulfillment?: ArtifactFulfillment[];
  contentToGenerate?: ContentToGenerate[];
  relevantDocuments?: RelevantDocument[];
  relevantProjects?: RelevantProject[];
  recommendedDeck?: RelevantDocument;
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
    roleInCall?: string;
    talkTimeSeconds?: number;
    talkTimeLabel?: string;
    score: number;
    label: string;
    strengths: string;
    watch: string;
    areasToWork?: string[];
  }[];
  learned: { label: string; from?: number; to?: number; note: string }[];
  openDiscoveryGaps?: string[];
  discoveryBantCoverage?: number;
}

export interface PostCallEmailDraft {
  id: string;
  audience?: "client" | "internal" | string;
  to: string[];
  cc?: string[];
  subject: string;
  body_markdown: string;
  style_signals: string[];
  commitments_referenced: string[];
  status: "draft_pending_approval" | "approved" | "sent";
  attachments?: PostCallEmailAttachments;
}

export interface PostCallEmailAttachmentFound {
  name: string;
  assetId: string;
  snippet?: string;
  downloadUrl?: string;
  previewUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileType?: string;
  source?: "knowledge_base" | string;
  reason?: string;
  /** KB retrieval relevance score (0–1). */
  matchScore?: number;
}

export interface PostCallEmailAttachmentMissing {
  name: string;
  requiredData: string;
  contentStudioLink: string;
  source?: "content_gap" | string;
}

export interface PostCallEmailAttachments {
  found: PostCallEmailAttachmentFound[];
  missing: PostCallEmailAttachmentMissing[];
}

export interface PostCallKbSuggestion {
  assetId: string;
  title?: string;
  reason?: string;
  suggestedUse?: string;
  downloadUrl?: string;
  snippet: string;
  score?: number | null;
}

export interface PostCallAgentCitation {
  source_type: string;
  source_id: string;
  snippet: string;
  confidence?: number | null;
}

export interface PostCallAgentEnvelope {
  agent?: string;
  operation?: string;
  trace_id?: string;
  confidence?: number | null;
  cost?: {
    tokens?: number;
    usd?: number;
    model?: string;
  };
  citations?: PostCallAgentCitation[];
}

export interface PostCallTask {
  id: string;
  task_type: "follow_up" | "internal_review" | "content_request" | "schedule_next_meeting";
  owner: string;
  due_date: string;
  description: string;
  status: "pending_approval" | "approved" | "created" | "failed";
  isInternalAuto?: boolean;
  crm_system?: "hubspot" | "salesforce";
}

export type PostCallCrmTask = PostCallTask;

export interface PostCallJiraSubtask {
  summary: string;
  description?: string;
  owner?: string;
  dueDate?: string;
  status?: "pending_approval" | "approved" | "created" | "failed" | string;
}

export interface PostCallJiraTicket {
  status: "draft_pending_approval" | "created" | "failed";
  summary: string;
  description: string;
  issueType: string;
  priority: "High" | "Medium" | "Low";
  labels: string[];
  projectKey: string;
  bantSnapshot: { budget: boolean; authority: boolean; need: boolean; timeline: boolean };
  subtasks?: PostCallJiraSubtask[];
  externalKey?: string;
  externalUrl?: string;
  error?: string;
}

export interface PostCallPipelineResult {
  callId?: string;
  accountName?: string;
  review?: PostCallReview;
  task?: {
    emailDraft?: PostCallEmailDraft;
    clientEmailDraft?: PostCallEmailDraft;
    internalEmailDraft?: PostCallEmailDraft;
    taskList?: PostCallTask[];
    crmTasks?: PostCallTask[];
  };
  emailAttachments?: PostCallEmailAttachments;
  jiraTicket?: PostCallJiraTicket | null;
  kbSuggestions?: PostCallKbSuggestion[];
  envelope?: PostCallAgentEnvelope;
  coaching?: {
    podScorecard?: PostCallReview["podScorecard"];
    bantProgression?: Record<string, unknown>;
  };
  agentInputs?: {
    sources?: {
      name: string;
      description: string;
      count: number;
    }[];
    transcriptEventCount?: number;
    transcriptDigestLimit?: number;
    liveSuggestionCount?: number;
    hasLiveSignalSnapshot?: boolean;
    hasDiscoverySnapshot?: boolean;
  };
  discovery?: {
    result?: {
      openGaps?: string[];
      checklist?: { bantCoverage?: number };
      bantCoverage?: number;
    };
    openGaps?: string[];
    checklist?: { bantCoverage?: number };
    bantCoverage?: number;
  };
  live_signals?: Record<string, unknown>;
}
