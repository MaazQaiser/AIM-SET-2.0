import type { Call, CoachingInsight, KBAsset, TranscriptEvent, NudgePayload } from "@/types";
import type { CrmTask } from "@/components/post-dc/crm-task-list";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

function atDayOffset(dayOffset: number, hour: number, minute = 0): string {
  const base = startOfDay(addDays(new Date(), dayOffset));
  return setMinutes(setHours(base, hour), minute).toISOString();
}

export const MOCK_CALLS: Call[] = [
  {
    id: "call-001",
    accountName: "Meridian Trust",
    scheduledAt: atDayOffset(0, 10, 0),
    status: "upcoming",
    briefReady: true,
    pod: [
      { id: "1", name: "Sarah Mendes", role: "ae", initials: "SM" },
      { id: "2", name: "Tariq Ali", role: "se", initials: "TA" },
    ],
    bant: { budget: "partial", authority: "confirmed", need: "confirmed", timeline: "unknown" },
  },
  {
    id: "call-002",
    accountName: "Beta Technologies",
    scheduledAt: atDayOffset(0, 14, 30),
    status: "upcoming",
    briefReady: false,
    pod: [
      { id: "3", name: "Maya Rivera", role: "designer", initials: "MR" },
    ],
    bant: { budget: "unknown", authority: "unknown", need: "partial", timeline: "unknown" },
  },
  {
    id: "call-live",
    accountName: "Acme Corp",
    scheduledAt: atDayOffset(0, 9, 0),
    status: "live",
    briefReady: true,
    pod: [
      { id: "1", name: "Sarah Mendes", role: "ae", initials: "SM" },
      { id: "2", name: "Tariq Ali", role: "se", initials: "TA" },
    ],
    bant: { budget: "partial", authority: "confirmed", need: "confirmed", timeline: "partial" },
  },
  {
    id: "call-003",
    accountName: "Northwind Capital",
    scheduledAt: atDayOffset(1, 9, 30),
    status: "upcoming",
    briefReady: true,
    pod: [{ id: "4", name: "James Liu", role: "ae", initials: "JL" }],
    bant: { budget: "confirmed", authority: "partial", need: "confirmed", timeline: "partial" },
  },
  {
    id: "call-004",
    accountName: "Helios Analytics",
    scheduledAt: atDayOffset(1, 14, 0),
    status: "upcoming",
    briefReady: false,
    pod: [
      { id: "1", name: "Sarah Mendes", role: "ae", initials: "SM" },
      { id: "5", name: "Priya Nair", role: "se", initials: "PN" },
    ],
    bant: { budget: "unknown", authority: "confirmed", need: "partial", timeline: "unknown" },
  },
  {
    id: "call-005",
    accountName: "Summit Ridge Partners",
    scheduledAt: atDayOffset(2, 11, 0),
    status: "upcoming",
    briefReady: true,
    pod: [{ id: "6", name: "Anika Shah", role: "ae", initials: "AS" }],
    bant: { budget: "partial", authority: "unknown", need: "confirmed", timeline: "partial" },
  },
  {
    id: "call-006",
    accountName: "Cascade Health",
    scheduledAt: atDayOffset(3, 10, 0),
    status: "upcoming",
    briefReady: true,
    pod: [
      { id: "3", name: "Maya Rivera", role: "designer", initials: "MR" },
      { id: "2", name: "Tariq Ali", role: "se", initials: "TA" },
    ],
    bant: { budget: "partial", authority: "confirmed", need: "partial", timeline: "confirmed" },
  },
  {
    id: "call-007",
    accountName: "Vertex Systems",
    scheduledAt: atDayOffset(4, 15, 30),
    status: "upcoming",
    briefReady: false,
    pod: [{ id: "4", name: "James Liu", role: "ae", initials: "JL" }],
    bant: { budget: "unknown", authority: "partial", need: "unknown", timeline: "unknown" },
  },
  {
    id: "call-008",
    accountName: "Pinnacle Insurance",
    scheduledAt: atDayOffset(5, 9, 0),
    status: "upcoming",
    briefReady: true,
    pod: [
      { id: "1", name: "Sarah Mendes", role: "ae", initials: "SM" },
      { id: "2", name: "Tariq Ali", role: "se", initials: "TA" },
    ],
    bant: { budget: "confirmed", authority: "confirmed", need: "confirmed", timeline: "partial" },
  },
];

export const COACHING_CANDIDATES = [
  {
    aeId: "ae-sarah",
    aeName: "Sarah Mendes",
    pattern: "On three of her last four calls she let the prospect drive the timeline conversation. Worth a 1:1 on commitment-anchoring before her Meridian Trust call.",
  },
  {
    aeId: "ae-james",
    aeName: "James Liu",
    pattern: "Closed strong last week. Second deal in a month with pricing pushback Wed–Fri. Worth understanding what he's doing differently.",
  },
  {
    aeId: "ae-anika",
    aeName: "Anika Shah",
    pattern: "New to the CIO persona. Two consecutive calls with sentiment dropping after technical pivot. Pairing opportunity with Tariq.",
  },
];

export const AE_COACHING_TRANSPARENCY = {
  aeName: "Sarah Mendes",
  managerName: "Marcus Okafor",
  moments: [
    {
      quote: "Totally understand, boards can be tricky.",
      context: "Meridian call — Eleanor waffling on timeline",
    },
    {
      quote: "No worries, we can figure that out as we go.",
      context: "Whitlock call — prospect had no budget yet",
    },
    {
      quote: "That's helpful to know.",
      context: "Cardinale call — soft timeline acceptance",
    },
  ],
};

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

export type InfluenceLevel = "decision-maker" | "influencer" | "champion" | "blocker" | "evaluator";
export type SentimentTrend = "positive" | "neutral" | "negative" | "improving" | "declining";

export interface ClientAttendee {
  id: string;
  name: string;
  title: string;
  department: string;
  influenceLevel: InfluenceLevel;
  background: string;          // LinkedIn-style bio snippet
  priorInteractionNote?: string;
  lastContactedAt?: string;
  linkedinUrl?: string;
}

export interface ClientInteraction {
  id: string;
  date: string;
  type: "discovery-call" | "demo" | "follow-up" | "email" | "proposal" | "no-show";
  outcome: string;             // one-line outcome
  keyMoments: string[];
  sentimentTrend: SentimentTrend;
  attendees: string[];         // names only
  durationMinutes?: number;
}

export interface CallBrief {
  callId: string;
  accountName: string;
  aiSummary: string;           // executive AI summary paragraph
  opportunityValue?: string;   // e.g. "$120K ARR"
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
  /** Full Pre-DC CSV research grouped for the brief UI */
  researchSections?: BriefResearchSection[];
  /** Linked Post-DC notes surfaced on the pre-call brief when available */
  postDcPreview?: PostDcBriefPreview;
  /** Full Post-DC CSV columns for review tab */
  postDcResearchSections?: BriefResearchSection[];
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

export function getCallBrief(callId: string): CallBrief {
  return {
    callId,
    accountName: callId.includes("meridian") || callId === "call-001" ? "Meridian Trust" : "Acme Corp",

    aiSummary:
      "Meridian Trust is at a pivotal moment — Eleanor Martin (CTO) introduced board-readiness language unprompted in the last call, signalling internal momentum. The ESG mandate expansion filed last Thursday is a live urgency driver that the pod hasn't yet referenced. This call should focus on anchoring a Q3 board decision with two named board members now confirmed as attendees. The primary risk is budget framing: Eleanor is likely to position this as a cost item; the winning move is to reframe as regulatory liability reduction before CFO language enters the conversation.",

    opportunityValue: "$118K ARR",
    dealStage: "Evaluation → Proposal",
    daysSinceLastContact: 8,

    icpMatch: 0.78,
    icpNote: "Tech stack signals classified ambiguously — competitor on one tier may be wedge-in or wall.",

    newSignals: [
      "Meridian filed an updated Form ADV last Thursday reflecting ESG mandate expansion (SEC public feed).",
    ],

    clientAttendees: [
      {
        id: "ca-1",
        name: "Eleanor Martin",
        title: "Chief Technology Officer",
        department: "Technology",
        influenceLevel: "decision-maker",
        background:
          "20-year FS technology leader. Former SVP at JPMorgan Chase. Led two large-scale core banking modernisations. Known for thorough vendor evaluation — does not rush decisions. Reads RFPs carefully; responds well to evidence-based ROI.",
        priorInteractionNote: "Opened up in our last call when we referenced the Form ADV expansion. Introduced board language for the first time. Positive body language signal.",
        lastContactedAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
        linkedinUrl: "#",
      },
      {
        id: "ca-2",
        name: "Robert Huang",
        title: "Chief Financial Officer",
        department: "Finance",
        influenceLevel: "blocker",
        background:
          "Joined Meridian 14 months ago from a private equity background. Has a strong cost-reduction mandate. Likely to push back on anything framed as 'platform spend'. Responds well to payback-period framing — 18-month ROI is his threshold.",
        priorInteractionNote: "Joining today's call for the first time. Not yet engaged. Prepare a crisp cost-avoidance narrative — do not lead with features.",
        lastContactedAt: undefined,
      },
      {
        id: "ca-3",
        name: "Priscilla Chen",
        title: "Head of Compliance & Risk",
        department: "Compliance",
        influenceLevel: "champion",
        background:
          "Driving the internal compliance modernisation initiative. Has budget authority up to $50K without board approval. Referencing her as a stakeholder gives credibility with Eleanor. She has already pulled two internal whitepapers on our approach.",
        priorInteractionNote: "Strongly supportive. Has used our compliance terminology in her last two internal emails (shared by Eleanor). She is the internal champion — direct your technical depth at her.",
        lastContactedAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
      },
      {
        id: "ca-4",
        name: "Marcus Webb",
        title: "IT Director",
        department: "IT Infrastructure",
        influenceLevel: "evaluator",
        background:
          "Responsible for technical due diligence and integration assessment. AWS-certified. Has concerns about API stability after a prior vendor migration went over schedule. Will want to discuss our 2-week integration sprint in detail.",
        priorInteractionNote: "Asked detailed API questions in the last call. Tariq handled it well mid-call. Follow up on the intraday reconciliation architecture doc — he mentioned it twice.",
        lastContactedAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
      },
    ],

    interactionHistory: [
      {
        id: "ih-1",
        date: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
        type: "discovery-call",
        outcome: "Strong call. Eleanor introduced board-readiness language for the first time. Two board members now confirmed for next call.",
        keyMoments: [
          "Eleanor connected ESG mandate expansion to accelerated timeline — first unprompted urgency signal.",
          "Robert Huang NOT on the call — financial objection risk is deferred to this session.",
          "Marcus Webb pushed back on integration timeline; Tariq recovered well with Boston hedge fund reference.",
          "Priscilla Chen referenced our compliance whitepaper unprompted — clear internal advocacy.",
        ],
        sentimentTrend: "improving",
        attendees: ["Eleanor Martin", "Priscilla Chen", "Marcus Webb"],
        durationMinutes: 52,
      },
      {
        id: "ih-2",
        date: new Date(Date.now() - 22 * 24 * 3600_000).toISOString(),
        type: "demo",
        outcome: "Demo well received. Compliance workflow resonated strongly with Priscilla. Eleanor asked about pricing — deferred to proposal stage.",
        keyMoments: [
          "Live compliance audit trail demo drew genuine engagement from Priscilla.",
          "Eleanor asked 'what does a typical enterprise contract look like' — positive buying signal.",
          "Marcus raised legacy API concern — not fully resolved in this session.",
        ],
        sentimentTrend: "positive",
        attendees: ["Eleanor Martin", "Priscilla Chen", "Marcus Webb"],
        durationMinutes: 45,
      },
      {
        id: "ih-3",
        date: new Date(Date.now() - 36 * 24 * 3600_000).toISOString(),
        type: "discovery-call",
        outcome: "Initial discovery. Pain confirmed around manual compliance reporting. Timeline vague. BANT mostly unknown.",
        keyMoments: [
          "Priscilla quantified 40% of team time spent on manual reporting.",
          "Eleanor engaged but reserved — standard for a first call with her profile.",
          "No budget discussed.",
        ],
        sentimentTrend: "neutral",
        attendees: ["Eleanor Martin", "Priscilla Chen"],
        durationMinutes: 38,
      },
    ],

    pains: [
      { text: "Regulatory reporting velocity (40% of compliance team time)", confidence: 0.91 },
      { text: "Data fragmentation across 3 legacy systems", confidence: 0.84 },
      { text: "CFO cost-reduction mandate creating platform consolidation pressure", confidence: 0.62 },
    ],
    objections: [
      {
        objection: "CFO Robert Huang will frame this as 'another platform cost'",
        handler:
          "Lead with regulatory liability avoidance, not features. Ask: 'What's the cost of a missed Form ADV filing?' before he anchors on price. Reference 18-month payback period from the Connecticut AUM case study.",
        confidence: 0.82,
      },
      {
        objection: "Budget tension Q3 vs Q4 board cycle",
        handler:
          'Acknowledge board reality, then ask: "When you bring this to the board, what are the two or three things that have to be true for it to land?"',
        confidence: 0.55,
      },
    ],
    deckSlides: [
      { id: "s1", title: "Opening — Who we are", usedInCalls: 20, progressedIn: 18, included: true },
      { id: "s2", title: "Discovery recap", usedInCalls: 15, progressedIn: 12, included: true },
      { id: "s3", title: "Corporate overview (remove — Eleanor already knows us)", usedInCalls: 8, progressedIn: 3, included: false },
      { id: "s4", title: "Regulatory liability: cost-avoidance framing", usedInCalls: 6, progressedIn: 6, included: true },
      { id: "s5", title: "Connecticut AUM modernization — 18-month ROI case study", usedInCalls: 14, progressedIn: 9, included: true },
    ],
    podNotes: [
      {
        memberName: "Tariq Ali",
        role: "SE",
        note: "Primary focus: Marcus Webb's API integration concern. Have the 2-week integration sprint spec ready. Reference the Boston hedge fund intraday reconciliation pattern if he pushes on timeline.",
        reviewedAt: new Date().toISOString(),
      },
      {
        memberName: "Sarah Mendes",
        role: "AE",
        note: "Open with the Form ADV ESG expansion signal — Eleanor hasn't heard you reference it yet. Anchor the board decision to Q3 in the first 10 minutes before Robert shifts to cost framing.",
        reviewedAt: new Date().toISOString(),
      },
    ],
  };
}

export const LIVE_TRANSCRIPT_SEED: TranscriptEvent[] = [
  { id: "t1", speakerId: "s1", speakerName: "Sarah (AE)", speakerRole: "ae", text: "Thanks for joining. Before we dive in — could you walk me through your current compliance workflow?", timestamp: 12, sentiment: "neutral" },
  { id: "t2", speakerId: "s2", speakerName: "Eleanor (Customer)", speakerRole: "customer", text: "Everything is manual. SOC 2 audit prep is extremely painful.", timestamp: 45, sentiment: "negative", keywords: ["compliance", "SOC 2", "audit"] },
  { id: "t3", speakerId: "s1", speakerName: "Sarah (AE)", speakerRole: "ae", text: "I noticed Meridian filed an updated Form ADV last Thursday — the ESG mandate expansion. How is that shifting your modernization timeline?", timestamp: 78, sentiment: "neutral", keywords: ["ESG", "Form ADV"], signalType: "discovery_anchor" },
  { id: "t4", speakerId: "s2", speakerName: "Eleanor (Customer)", speakerRole: "customer", text: "We're probably looking at Q3 to bring this to the board, but you know how boards are.", timestamp: 1140, sentiment: "neutral", keywords: ["Q3", "board"] },
];

export const LIVE_NUDGES_SEED: NudgePayload[] = [
  {
    id: "n-ae-1",
    message: "Suggested move: ask what has to be true for the board.",
    citation: { id: "c1", title: "Commitment-anchoring playbook", type: "one-pager" },
    role: "ae",
    timestamp: 1140,
  },
  {
    id: "n-se-1",
    message: "Reference architecture: Boston hedge fund intraday reconciliation pattern.",
    citation: { id: "c2", title: "Intraday reconciliation — reference arch", type: "architecture" },
    role: "se",
    timestamp: 1860,
  },
];

export const KEYWORD_DEFINITIONS: Record<string, { title: string; definition: string; assetHint?: string }> = {
  "continuous compliance": {
    title: "Continuous compliance",
    definition: "Regulatory framework where compliance status is monitored in real-time rather than at periodic audits.",
    assetHint: "2024 webinar deck available in KB",
  },
  "SOC 2": {
    title: "SOC 2",
    definition: "Service Organization Control 2 — audit framework for security, availability, and confidentiality.",
    assetHint: "Delta Finance case study",
  },
  compliance: {
    title: "Compliance",
    definition: "Adherence to laws, regulations, and internal policies governing financial operations.",
  },
};

export interface BantSignal {
  id: string;
  label: string;
  timestamp: number;
  dimension: "budget" | "authority" | "need" | "timeline";
}

export const LIVE_BANT_SIGNALS: BantSignal[] = [
  { id: "b1", label: "Budget framework signal", timestamp: 1200, dimension: "budget" },
  { id: "b2", label: "Authority structure signal", timestamp: 1210, dimension: "authority" },
  { id: "b3", label: "Regulatory pain quantification", timestamp: 1220, dimension: "need" },
];

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

export function getPostCallReview(_callId: string): PostCallReview {
  return {
    headline:
      "Strong call. Eleanor introduced board-readiness language for the first time. Two named decision-makers joining next call.",
    summary: [
      "Eleanor connected ESG mandate expansion to accelerated timeline — first unprompted urgency signal.",
      "Board-readiness move landed: regulatory liability quantified, phased investment framing, 18-month reference customers requested.",
    ],
    podScorecard: [
      {
        member: "Sarah Mendes",
        role: "AE",
        score: 0.86,
        label: "strong",
        strengths: "Anchored discovery on board-readiness; used acknowledged objection technique well.",
        watch: "Still occasionally trails off on commitment moments — flagged for coaching context.",
      },
      {
        member: "Tariq Ali",
        role: "SE",
        score: 0.71,
        label: "developing",
        strengths: "Strong recovery mid-call on intraday reconciliation.",
        watch: "Initial response generic; reviewing with sales engineering manager.",
      },
      {
        member: "Pod overall",
        role: "Pod",
        score: 0.81,
        label: "strong",
        strengths: "Recommended for next stage.",
        watch: "",
      },
    ],
    learned: [
      { label: "Cost-pressure pain", from: 0.62, to: 0.45, note: "Eleanor framed as investment, not cost." },
      { label: "Timeline pain", note: "Upgraded to confirmed — Q3 board decision with named members." },
      { label: "ESG regulatory pressure", note: "New signal: primary urgency driver." },
    ],
  };
}

export const MOCK_CRM_TASKS_POST_DC: CrmTask[] = [
  {
    id: "task-1",
    crm_system: "salesforce",
    task_type: "follow_up",
    owner: "Sarah Mendes",
    due_date: new Date(Date.now() + 2 * 24 * 3600_000).toISOString(),
    description: "Send case study with 18-month customer reference to Eleanor",
    status: "pending_approval",
  },
  {
    id: "task-2",
    crm_system: "salesforce",
    task_type: "schedule_next_meeting",
    owner: "Sarah Mendes",
    due_date: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
    description: "Confirm board attendees for next Tuesday call",
    status: "pending_approval",
  },
  {
    id: "task-3",
    crm_system: "salesforce",
    task_type: "internal_review",
    owner: "Marcus Okafor (Manager)",
    due_date: new Date(Date.now() + 4 * 24 * 3600_000).toISOString(),
    description: "Pair Tariq with senior SE for next Meridian call — technical depth flag",
    status: "pending_approval",
    isInternalAuto: true,
  },
];

export const KB_WATCHLIST = [
  { assetId: "kb1", title: "Whitlock Capital Modernization (2023)", reason: "Used in 14 calls; 9 progressions. Strong asset.", action: "none" as const },
  { assetId: "kb4", title: "Legacy System Integration Playbook (2022)", reason: "No use in 90 days. Recommend deprecate or refresh.", action: "deprecate" as const },
  { assetId: "kb-draft", title: "Mid-Market ESG Compliance Brief (Draft)", reason: "Auto-drafted from 3 FS calls. Awaiting review.", action: "review" as const },
];

export const COACHING_INSIGHTS: CoachingInsight[] = [
  { id: "ci1", aeId: "ae-sarah", aeName: "Sarah Mendes", aeInitials: "SM", pattern: "Skips needs qualification before pricing", evidenceQuote: "Let me tell you about our pricing...", callId: "call-001", recommendation: "Practice deferring pricing until BANT need is confirmed.", priority: "high" },
];

export const QUARTERLY_PATTERNS = [
  { title: "ESG mandate FS prospects converting 22% faster", sampleSize: 34, confidence: 0.91, strength: "high" as const },
  { title: "Stumble-and-recovery calls score 18% higher than no-stumble", sampleSize: 47, confidence: 0.72, strength: "medium" as const },
  { title: "Anika CIO sentiment-drop pattern resolved", sampleSize: 8, confidence: 0.85, strength: "high" as const },
];

export const CONTENT_GAPS = [
  { id: "cg1", topic: "Real-time compliance audit trail for hybrid cloud", sourcedFrom: "Meridian Trust DC — Sarah Mendes", callId: "call-001", status: "draft" as const, draftType: "deck" as const },
];
