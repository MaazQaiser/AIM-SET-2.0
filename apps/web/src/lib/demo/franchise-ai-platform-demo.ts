import type { Call } from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";
import type { DemoTranscriptLine } from "@/lib/demo-live-transcript";

/** Demo DC: prospect requests proposal for AI-native franchise operations platform. */
export const FRANCHISE_DEMO_CALL_ID = "frontera-franchise-group";

export const franchiseDemoCall: Call = {
  id: FRANCHISE_DEMO_CALL_ID,
  accountName: "Frontera Franchise Group",
  leadName: "Marcus Chen",
  leadTitle: "Chief Operating Officer",
  industry: "Multi-unit franchise · QSR & fast casual",
  annualRevenue: "$180M system-wide",
  employeeCount: "2,400 (corporate + franchisees)",
  icpBucket: "Enterprise franchise ops",
  website: "fronterafranchise.com",
  dealStage: "Evaluation → Proposal",
  discoveryCallDatePkt: "2026-05-21",
  discoveryCallTimePkt: "10:00 AM",
  meetingUrl: "https://meet.google.com/demo-frontera-dc",
  scheduledAt: new Date("2026-05-21T05:00:00.000Z").toISOString(),
  duration: 45,
  status: "upcoming",
  briefReady: true,
  bant: {
    budget: "partial",
    authority: "partial",
    need: "confirmed",
    timeline: "confirmed",
  },
  pod: [
    { id: "ae-1", name: "Sarah Mendes", role: "ae", initials: "SM" },
    { id: "se-1", name: "Tariq Hassan", role: "se", initials: "TH" },
  ],
};

export const franchiseDemoBrief: CallBrief = {
  callId: FRANCHISE_DEMO_CALL_ID,
  accountName: "Frontera Franchise Group",
  aiSummary:
    "Frontera operates 140 franchise locations across North America with fragmented ops tooling. Marcus Chen (COO) is driving an **AI-native platform** initiative to unify franchise execution, compliance, and unit economics — and expects a **formal proposal** after this discovery call. Pre-call intel suggests **$450K–$600K** first-year envelope and a **Q3 pilot / Q1 production** timeline pending board sign-off in May.",
  opportunityValue: "$450K–$600K (year-one platform + rollout)",
  dealStage: "Evaluation → Proposal",
  daysSinceLastContact: 12,
  icpMatch: 0.86,
  icpNote:
    "Strong ICP: multi-unit franchise, ops modernization mandate, executive sponsor. Competing build-vs-buy with internal data team.",
  newSignals: [
    "RFP-style proposal requested on the call",
    "Board review targeted for May — budget band stated on-record",
    "Pilot franchisees identified (Texas + Arizona regions)",
  ],
  clientAttendees: [
    {
      id: "marcus-chen",
      name: "Marcus Chen",
      title: "Chief Operating Officer",
      department: "Operations",
      influenceLevel: "decision-maker",
      background:
        "Former regional ops lead; owns franchise compliance and unit P&L reporting. Direct quote in SDR notes: needs “one system of execution” across brands.",
      priorInteractionNote: "Attended 20-min intro webinar; asked for discovery on AI orchestration layer.",
    },
  ],
  internalAttendees: [
    {
      id: "ae-sarah",
      name: "Sarah Mendes",
      role: "ae",
      designation: "Account Executive",
      fitReason: "Franchise retail portfolio · discovery-led selling",
      initials: "SM",
    },
    {
      id: "se-tariq",
      name: "Tariq Hassan",
      role: "se",
      designation: "Solutions Architect",
      fitReason: "Multi-tenant ops platforms · integration patterns",
      initials: "TH",
    },
  ],
  interactionHistory: [
    {
      id: "intro-webinar",
      date: "2026-05-09",
      type: "demo",
      outcome: "Requested full discovery — focus on franchise ops AI layer",
      keyMoments: ["Asked how agents coordinate across franchisee vs corporate roles"],
      sentimentTrend: "positive",
      attendees: ["Marcus Chen"],
      durationMinutes: 22,
    },
  ],
  pains: [
    {
      text: "Franchise operators rely on spreadsheets and disconnected POS integrations — no single execution layer",
      confidence: 0.91,
    },
    {
      text: "COO lacks real-time unit-level performance and compliance visibility across 140 locations",
      confidence: 0.88,
    },
    {
      text: "Manual compliance and brand-standard audits create bottlenecks before regional expansion",
      confidence: 0.84,
    },
  ],
  objections: [
    {
      objection: "Internal team is prototyping a lightweight orchestration layer",
      handler:
        "Position phased co-build: we own production-grade agent fabric + integrations; their team keeps domain rules.",
      confidence: 0.72,
    },
  ],
  deckSlides: [],
  podNotes: [
    {
      memberName: "Sarah Mendes",
      role: "AE",
      note: "Lead with proposal path — Marcus said he needs something board-ready in two weeks.",
    },
    {
      memberName: "Tariq Hassan",
      role: "SE",
      note: "Prepare reference: multi-unit retail agent mesh + franchisee permission model.",
    },
  ],
  researchSections: [
    {
      title: "Opportunity framing",
      items: [
        { label: "Ask", value: "Proposal for AI-native platform for franchise operations" },
        { label: "Scope", value: "Corporate + franchisee workflows, compliance, unit analytics" },
        { label: "Competition", value: "Internal build + legacy franchise management suite" },
      ],
    },
  ],
};

export const franchiseDemoPostReview: PostCallReview = {
  headline:
    "Proposal requested · AI-native franchise ops platform · $450–600K budget band · Q3 pilot / board in May",
  summary: [
    "Marcus Chen (COO) confirmed Frontera needs a **formal proposal** for an **AI-native platform** to run franchise operations — not a point tool. Scope spans corporate orchestration, franchisee execution, compliance workflows, and unit-level analytics across **140 locations**. He asked for a board-ready package within **two weeks**.",
    "**Budget:** On-record range of **$450K–$600K** for year-one platform license, integration, and pilot rollout (10–15 locations). Marcus noted CFO already reserved a modernization line item but final approval sits with the **May board cycle**.",
    "**Timeline:** Target **Q3 2026 pilot** (Texas + Arizona franchisees), **production hardening by Q1 2027**. Internal build team has a skunkworks orchestration prototype — prospect prefers a partner who can ship production agent infrastructure while their team keeps brand rules.",
    "**Sentiment:** Customer tone moved from cautious-neutral to **positive** once SE described multi-tenant agent mesh and franchisee permission boundaries. AE stayed strong on commercial discovery; watch item is **authority depth** — economic buyer (CFO) not on the call.",
    "**Pains validated:** (1) spreadsheet + POS fragmentation, (2) no unified COO visibility, (3) manual compliance audits blocking expansion. Intent classified **commercial_discovery** with **timeline_planning** signals after budget/timeline lines.",
    "**Discovery coverage:** BANT **78%** — budget partial (range confirmed, board pending), authority partial (COO sponsor, CFO/board TBD), need & timeline confirmed. **Action:** send proposal outline + pilot SOW template; schedule CFO readout; attach franchise retail reference architecture.",
  ],
  discoveryBantCoverage: 0.78,
  openDiscoveryGaps: ["authority", "decision_process"],
  podScorecard: [
    {
      member: "Sarah Mendes",
      role: "AE",
      score: 0.84,
      label: "Strong",
      strengths:
        "Anchored proposal ask early; captured budget band and board date without deflecting.",
      watch: "Book CFO / economic buyer session before proposal delivery.",
    },
    {
      member: "Tariq Hassan",
      role: "SE",
      score: 0.88,
      label: "Strong",
      strengths:
        "Franchisee permission model + agent mesh resonated; reduced build-vs-buy anxiety.",
      watch: "Include integration map for POS + legacy franchise suite in proposal appendix.",
    },
  ],
  learned: [
    {
      label: "Budget",
      note: "$450K–$600K year-one (platform + pilot); CFO line item exists; board approval May 2026",
    },
    {
      label: "Authority",
      note: "Marcus Chen (COO) sponsor; CFO + board approval required; CEO briefed async",
    },
    {
      label: "Need",
      note: "AI-native execution layer for franchise ops — compliance, unit analytics, corporate/franchisee orchestration",
    },
    {
      label: "Timeline",
      note: "Proposal in 2 weeks · Q3 pilot · Q1 2027 production · May board gate",
    },
    {
      label: "Sentiment (customer)",
      from: 0.05,
      to: 0.52,
      note: "Warming after technical depth on multi-tenant agents; no negative shift detected",
    },
    {
      label: "Call intent",
      note: "commercial_discovery + timeline_planning (proposal + budget + go-live language)",
    },
  ],
  researchSections: [
    {
      title: "Actionable results",
      items: [
        { label: "Next step", value: "Deliver board-ready proposal + pilot SOW by Jun 4" },
        { label: "Pain signals", value: "3 validated (fragmentation, visibility, compliance)" },
        { label: "Intent", value: "Commercial discovery · proposal path" },
        { label: "Discovery coverage", value: "78% BANT · gaps: authority, decision process" },
      ],
    },
  ],
};

export const FRANCHISE_DEMO_TRANSCRIPT: DemoTranscriptLine[] = [
  {
    text: "Thanks Marcus — we'll keep this focused on your franchise operations modernization goals.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 8,
    pauseAfterMs: 2000,
  },
  {
    text: "Appreciate it. Bottom line — we need an AI-native platform to actually run franchise operations, not another dashboard. I'm expecting a formal proposal after today.",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 22,
    pauseAfterMs: 2800,
  },
  {
    text: "Understood. When you say AI-native for franchise ops — what's broken today across corporate and franchisees?",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 38,
    pauseAfterMs: 2200,
  },
  {
    text: "Honestly it's a nightmare — operators live in spreadsheets, every POS integration is different, and I have zero real-time view of unit performance or compliance across 140 locations.",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 52,
    pauseAfterMs: 3000,
  },
  {
    text: "Manual brand-standard audits are the bottleneck before we open the next regional wave — that's the pain keeping me up at night.",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 68,
    pauseAfterMs: 2500,
  },
  {
    text: "For budget — we've carved roughly four hundred fifty to six hundred thousand for year one, platform plus pilot rollout. Board still has to bless it in May.",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 95,
    pauseAfterMs: 3200,
  },
  {
    text: "Timeline-wise we want a Q3 pilot with ten to fifteen Texas and Arizona franchisees, production-grade by Q1 next year. Can you hit that go-live window?",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 108,
    pauseAfterMs: 2800,
  },
  {
    text: "We have an internal team prototyping a lightweight orchestration layer — why partner instead of finishing in-house?",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 118,
    pauseAfterMs: 2400,
  },
  {
    text: "We separate concerns — you keep brand rules and domain agents; we ship the production agent fabric, franchisee permission boundaries, and POS integrations.",
    speakerId: "se-tariq",
    speakerName: "Tariq",
    speakerRole: "se",
    offsetSeconds: 132,
    pauseAfterMs: 2600,
  },
  {
    text: "That's the first answer that doesn't sound like vaporware. Multi-tenant agent mesh is exactly what our architecture review kept asking for.",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 148,
    pauseAfterMs: 2500,
  },
  {
    text: "Great — we'll send a board-ready proposal inside two weeks with pilot scope, integration map, and reference customers in multi-unit retail.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 165,
    pauseAfterMs: 2000,
  },
  {
    text: "Please include CFO-level ROI and a clear decision process — I'll pull our CFO into a readout once we have the draft.",
    speakerId: "marcus-chen",
    speakerName: "Marcus",
    speakerRole: "customer",
    offsetSeconds: 178,
    pauseAfterMs: 1500,
  },
];

export function mergeFranchiseDemoCalls(calls: Call[]): Call[] {
  if (calls.some((c) => c.id === FRANCHISE_DEMO_CALL_ID)) return calls;
  const hasSameAccount = calls.some(
    (c) => c.accountName?.trim().toLowerCase() === franchiseDemoCall.accountName.trim().toLowerCase()
  );
  if (hasSameAccount) return calls;
  return [franchiseDemoCall, ...calls];
}

export function isFranchiseDemoCall(callId: string): boolean {
  return callId === FRANCHISE_DEMO_CALL_ID;
}
