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
  interactionHistory: ClientInteraction[];
  pains: HypothesizedPain[];
  objections: AnticipatedObjection[];
  deckSlides: DeckSlide[];
  podNotes: { memberName: string; role: string; note: string; reviewedAt?: string }[];
  researchSections?: BriefResearchSection[];
  postDcPreview?: PostDcBriefPreview;
  postDcResearchSections?: BriefResearchSection[];
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
}
