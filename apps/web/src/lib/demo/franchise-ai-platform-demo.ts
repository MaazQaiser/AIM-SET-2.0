import type { Call } from "@/types";
import type {
  CallBrief,
  PostCallAgentEnvelope,
  PostCallEmailDraft,
  PostCallJiraTicket,
  PostCallKbSuggestion,
  PostCallReview,
  PostCallTask,
} from "@/lib/brief-types";
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
      roleInCall: "Account Executive",
      talkTimeSeconds: 24,
      talkTimeLabel: "24s",
      score: 0.84,
      label: "Strong",
      strengths:
        "Anchored proposal ask early; captured budget band and board date without deflecting.",
      watch: "Book CFO / economic buyer session before proposal delivery.",
      areasToWork: ["Book CFO / economic buyer session before proposal delivery."],
    },
    {
      member: "Tariq Hassan",
      role: "SE",
      roleInCall: "Solutions Engineer",
      talkTimeSeconds: 17,
      talkTimeLabel: "17s",
      score: 0.88,
      label: "Strong",
      strengths:
        "Franchisee permission model + agent mesh resonated; reduced build-vs-buy anxiety.",
      watch: "Include integration map for POS + legacy franchise suite in proposal appendix.",
      areasToWork: ["Include integration map for POS + legacy franchise suite in proposal appendix."],
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

export const franchiseDemoEmailDraft: PostCallEmailDraft = {
  id: "email-frontera-follow-up",
  audience: "client",
  to: ["marcus.chen@fronterafranchise.com"],
  cc: ["sarah.mendes@tkxel.com", "tariq.hassan@tkxel.com"],
  subject: "Frontera franchise ops proposal next steps",
  body_markdown:
    "Hi Marcus,\n\nThanks again for the direct conversation today. Here is what I captured from our discussion:\n\nWhat we discussed:\n- An AI-native execution layer for corporate and franchisee workflows across 140 locations\n- POS and legacy franchise-suite integrations with clear franchisee permission boundaries\n- A Q3 pilot path for Texas and Arizona, with production hardening by Q1 2027\n\nWhat we committed to:\n- Share a board-ready proposal package with pilot scope, integration map, CFO-level ROI framing, and reference architecture\n- Include the multi-unit retail AI reference architecture as supporting material\n- Coordinate the next proposal readout so we can walk through scope, ROI, and rollout assumptions together\n\nReferences we are sharing:\n- Multi-unit retail AI reference architecture\n- Pilot SOW outline and CFO ROI one-pager once those drafts are ready\n\nNext touch base:\n- We will follow up with proposed times for the proposal readout and align on who should join from your side.\n\nLooking forward,\nSarah",
  style_signals: ["concise", "board-ready", "action-oriented"],
  commitments_referenced: [
    "Send board-ready proposal package within two weeks.",
    "Include pilot SOW, integration map, and CFO-level ROI framing.",
    "Schedule CFO readout before final proposal delivery.",
  ],
  status: "draft_pending_approval",
  attachments: {
    found: [
      {
        name: "Multi-unit retail AI reference architecture",
        assetId: "demo-franchise-reference-architecture",
        snippet: "Agent mesh, franchisee permission model, POS integration lanes.",
        downloadUrl: "/knowledge/demo-franchise-reference-architecture",
        previewUrl: "/knowledge/demo-franchise-reference-architecture",
        fileName: "multi-unit-retail-ai-reference-architecture.pdf",
        mimeType: "application/pdf",
        fileType: "PDF",
      },
    ],
    missing: [
      {
        name: "Frontera pilot SOW",
        requiredData: "Pilot scope for 10-15 Texas and Arizona franchisees, delivery plan, and success metrics.",
        contentStudioLink:
          "/content/studio?template=pilot_sow&account=Frontera%20Franchise%20Group&source=post-dc",
      },
      {
        name: "CFO ROI one-pager",
        requiredData: "Unit economics, audit-time savings, compliance impact, and year-one investment case.",
        contentStudioLink:
          "/content/studio?template=roi_one_pager&account=Frontera%20Franchise%20Group&source=post-dc",
      },
    ],
  },
};

export const franchiseDemoInternalEmailDraft: PostCallEmailDraft = {
  id: "internal-email-frontera-follow-up",
  audience: "internal",
  to: ["sales-pod@tkxel.com"],
  cc: ["sarah.mendes@tkxel.com", "tariq.hassan@tkxel.com"],
  subject: "Internal Post-DC action plan: Frontera Franchise Group",
  body_markdown:
    "Internal Post-DC summary for Frontera Franchise Group\n\nBANT score: 78%\nBANT details:\n- Budget: partial, $450K-$600K envelope discussed\n- Authority: partial, COO sponsor with CFO/board approval path pending\n- Need: confirmed, franchise operations fragmentation and compliance visibility\n- Timeline: confirmed, Q3 pilot and Q1 2027 production target\n\nNext action items:\n- [AE] Review and send Marcus the follow-up email with proposal timing and next-step owners.\n- [AE] Schedule CFO readout before the board-ready proposal is finalized.\n- [Pod] Run internal proposal debrief and assign owners for pilot SOW, integration map, and ROI one-pager.\n\nRecommended next step: Deliver board-ready proposal + pilot SOW by Jun 4.",
  style_signals: ["internal", "action-oriented", "bant-focused"],
  commitments_referenced: [
    "Review and send the follow-up email.",
    "Schedule CFO readout.",
    "Assign proposal asset owners.",
  ],
  status: "draft_pending_approval",
};

export const franchiseDemoCrmTasks: PostCallTask[] = [
  {
    id: "task-frontera-follow-up-email",
    task_type: "follow_up",
    owner: "AE",
    due_date: "2026-06-02T17:00:00.000Z",
    description: "Review and send Marcus the follow-up email with proposal timing and next-step owners.",
    status: "pending_approval",
  },
  {
    id: "task-frontera-cfo-readout",
    task_type: "schedule_next_meeting",
    owner: "AE",
    due_date: "2026-06-04T17:00:00.000Z",
    description: "Schedule CFO readout before the board-ready proposal is finalized.",
    status: "pending_approval",
  },
  {
    id: "task-frontera-proposal-debrief",
    task_type: "internal_review",
    owner: "Pod",
    due_date: "2026-06-03T17:00:00.000Z",
    description: "Internal debrief: confirm proposal scope, POS integration appendix, and reference assets.",
    status: "pending_approval",
    isInternalAuto: true,
  },
];

export const franchiseDemoKbSuggestions: PostCallKbSuggestion[] = [
  {
    assetId: "demo-franchise-reference-architecture",
    title: "Multi-unit retail AI reference architecture",
    reason: "Matches the follow-up need for franchisee permissions, POS integration lanes, and a scalable AI operations layer.",
    suggestedUse: "Attach to the proposal package as technical proof for the pilot architecture.",
    snippet: "Reference architecture for multi-tenant franchise ops, franchisee permissions, and POS data flows.",
    score: 0.91,
  },
  {
    assetId: "demo-retail-ai-case-study",
    title: "Retail AI compliance automation case study",
    reason: "Matches the validated pain around compliance audits, regional visibility, and franchise operating consistency.",
    suggestedUse: "Use as a proof point in the CFO readout or proposal narrative.",
    snippet: "Case study showing compliance workflow automation and region-level performance visibility.",
    score: 0.84,
  },
];

export const franchiseDemoJiraTicket: PostCallJiraTicket = {
  status: "draft_pending_approval",
  summary: "[DC Follow-up] Frontera Franchise Group opportunity",
  description:
    "Client summary:\n- Frontera needs an AI-native execution layer for franchise operations across 140 locations.\n- The client is requesting a board-ready proposal package for a Q3 pilot and Q1 2027 production path.\n\nClient details / needs:\n- Validated needs include franchise workflow fragmentation, POS integration variance, and compliance visibility.\n- The proposal should clarify pilot scope, franchisee permission boundaries, and integration approach.\n\nTimeline / POC:\n- Q3 pilot path for Texas and Arizona franchisees.\n- Production hardening target in Q1 2027.\n- Schedule the next proposal readout before finalizing the package.\n\nNeeded materials:\n- Pilot SOW\n- Integration map\n- Multi-unit retail AI reference architecture\n\nAction items:\n- Review and send Marcus the follow-up email with proposal timing and next-step owners.\n- Schedule proposal readout before the board-ready proposal is finalized.\n- Confirm proposal scope, POS integration appendix, and reference assets.",
  issueType: "Review",
  priority: "High",
  labels: ["discovery-call", "bant-review-needed", "franchise-ops"],
  projectKey: "SALES",
  bantSnapshot: {
    budget: false,
    authority: false,
    need: true,
    timeline: true,
  },
};

export const franchiseDemoAgentEnvelope: PostCallAgentEnvelope = {
  agent: "post_dc",
  operation: "review_produced",
  trace_id: "demo-frontera-post-dc",
  confidence: 0.86,
  cost: {
    tokens: 0,
    usd: 0,
    model: "demo-seeded",
  },
  citations: [
    {
      source_type: "transcript",
      source_id: FRANCHISE_DEMO_CALL_ID,
      snippet:
        "Please include CFO-level ROI and a clear decision process — I'll pull our CFO into a readout once we have the draft.",
      confidence: 0.9,
    },
    {
      source_type: "crm_record",
      source_id: FRANCHISE_DEMO_CALL_ID,
      snippet: "$450K-$600K first-year envelope; Q3 pilot / Q1 production timeline.",
      confidence: 0.84,
    },
  ],
};

export const franchiseDemoPostCallArtifacts = {
  emailDraft: franchiseDemoEmailDraft,
  internalEmailDraft: franchiseDemoInternalEmailDraft,
  crmTasks: franchiseDemoCrmTasks,
  jiraTicket: null,
  kbSuggestions: franchiseDemoKbSuggestions,
  envelope: franchiseDemoAgentEnvelope,
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
