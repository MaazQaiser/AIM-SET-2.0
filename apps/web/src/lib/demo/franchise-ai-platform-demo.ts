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
import { internalAvatarUrl } from "@/lib/attendees/participant-display";

/** Demo DC: prospect evaluates a healthcare software delivery partner. */
export const FRANCHISE_DEMO_CALL_ID = "frontera-franchise-group";

export const franchiseDemoCall: Call = {
  id: FRANCHISE_DEMO_CALL_ID,
  accountName: "CareBridge Health Group",
  leadName: "Dr. Lena Ortiz",
  leadTitle: "Chief Operating Officer",
  industry: "Healthcare provider network",
  annualRevenue: "$240M annual revenue",
  employeeCount: "1,800 clinicians and operations staff",
  icpBucket: "Enterprise · Desirable",
  website: "carebridgehealth.com",
  dealStage: "Enterprise",
  icpMatch: 0.88,
  discoveryCallDatePkt: "2026-05-21",
  discoveryCallTimePkt: "10:00 AM",
  meetingUrl: "https://meet.google.com/demo-carebridge-dc",
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
    { id: "ae-1", name: "Sarah Mendes", role: "ae", initials: "SM", avatarUrl: internalAvatarUrl("Sarah Mendes", "ae-1") },
  ],
};

export const franchiseDemoBrief: CallBrief = {
  callId: FRANCHISE_DEMO_CALL_ID,
  accountName: "CareBridge Health Group",
  aiSummary:
    "CareBridge Health Group operates 32 outpatient clinics and two specialty centers with fragmented intake, scheduling, referral, billing, and patient follow-up workflows. Dr. Lena Ortiz is evaluating a partner for a custom healthcare software platform and a dedicated delivery pod. Pre-call intel suggests a $650K-$800K year-one budget, a July decision target, and an August pilot.",
  opportunityValue: "$650K-$800K (year-one product build and delivery pod)",
  dealStage: "Evaluation → Proposal",
  daysSinceLastContact: 12,
  icpMatch: 0.88,
  icpNote:
    "Strong ICP: healthcare provider network, operational modernization mandate, COO sponsor, CFO engaged, clear software and delivery team needs.",
  newSignals: [
    "Customer wants a healthcare software solution for existing clinics",
    "Expansion plan requires scalable workflows before opening new locations",
    "Dedicated team of three to four people requested for ongoing software needs",
  ],
  clientAttendees: [
    {
      id: "lena-ortiz",
      name: "Dr. Lena Ortiz",
      title: "Chief Operating Officer",
      department: "Operations",
      influenceLevel: "decision-maker",
      background:
        "Owns clinic operations, patient access, service line expansion, and executive reporting. Direct quote in SDR notes: needs one operating layer across clinics.",
      priorInteractionNote: "Requested discovery after reviewing healthcare delivery examples and integration capabilities.",
    },
    {
      id: "omar-brooks",
      name: "Omar Brooks",
      title: "Director of Operations",
      department: "Clinical Operations",
      influenceLevel: "influencer",
      background:
        "Owns intake throughput, clinic launch readiness, and day-to-day workflow adoption.",
    },
    {
      id: "priya-nair",
      name: "Priya Nair",
      title: "Finance Lead",
      department: "Finance",
      influenceLevel: "influencer",
      background:
        "Owns budget modeling and executive approval packet for the first-year build.",
    },
  ],
  internalAttendees: [
    {
      id: "ae-sarah",
      name: "Sarah Mendes",
      role: "ae",
      designation: "Account Executive",
      fitReason: "Healthcare modernization portfolio · discovery-led selling",
      initials: "SM",
      avatarUrl: internalAvatarUrl("Sarah Mendes", "ae-sarah"),
    },
  ],
  interactionHistory: [
    {
      id: "intro-webinar",
      date: "2026-05-09",
      type: "demo",
      outcome: "Requested full discovery for clinic operations software and delivery pod",
      keyMoments: ["Asked how Tkxel handles healthcare workflow integrations and ongoing support"],
      sentimentTrend: "neutral",
      attendees: ["Dr. Lena Ortiz", "Omar Brooks", "Priya Nair"],
      durationMinutes: 22,
    },
  ],
  pains: [
    {
      text: "Patient intake, scheduling, and eligibility workflows are handled across spreadsheets and disconnected systems",
      confidence: 0.91,
    },
    {
      text: "Operations team lacks real-time visibility into clinic capacity, referral status, and patient handoffs",
      confidence: 0.88,
    },
    {
      text: "Expansion into new clinics is blocked by manual launch checklists and inconsistent software support",
      confidence: 0.84,
    },
  ],
  objections: [
    {
      objection: "Customer is skeptical after generic vendor calls and worries about healthcare context",
      handler:
        "Lead with healthcare delivery examples, show the company deck briefly, then connect Tkxel delivery model to their concrete needs.",
      confidence: 0.72,
    },
  ],
  deckSlides: [],
  podNotes: [
    {
      memberName: "Sarah Mendes",
      role: "AE",
      note: "Start with a crisp company deck if the customer is skeptical, then move quickly into clinic workflow discovery.",
    },
  ],
  researchSections: [
    {
      title: "Opportunity framing",
      items: [
        { label: "Ask", value: "Custom healthcare software platform plus dedicated delivery pod" },
        { label: "Scope", value: "Existing clinic workflows, expansion readiness, integrations, support team" },
        { label: "Decision", value: "July 20 decision target with August pilot" },
      ],
    },
  ],
};

export const franchiseDemoPostReview: PostCallReview = {
  headline:
    "Proposal requested · healthcare software platform · $650K-$800K budget · July decision and August pilot",
  summary: [
    "Dr. Lena Ortiz confirmed CareBridge needs a formal proposal for a custom healthcare software platform, not another dashboard. Scope spans existing clinic workflows, patient intake, scheduling, eligibility checks, referral updates, reporting, and a dedicated delivery pod for ongoing software needs.",
    "**Budget:** On-record range of **$650K-$800K** for year one, including first release, integrations, and a dedicated team of three to four people. Priya Nair owns the financial model.",
    "**Timeline:** Partner selection by **July 20**, discovery and design in late July, pilot build in **August**, and a working pilot in two clinics by **October**. If successful, CareBridge wants rollout into the next clinic wave by **January**.",
    "**Sentiment:** Customer opened skeptical after generic vendor calls and became positive once Sarah grounded the company deck and tied Tkxel delivery to concrete healthcare workflows.",
    "**Pains validated:** (1) scattered intake and scheduling workflows, (2) duplicate patient data entry and referral status gaps, (3) expansion blocked by inconsistent clinic launch processes. Needs confirmed: existing software solution, expansion platform, and dedicated team.",
    "**Discovery coverage:** BANT **82%**. Budget, need, and timeline confirmed. Authority is partial because CIO Daniel Reed still needs to approve security and integration assumptions.",
  ],
  nextStepProposal:
    "Send a healthcare software proposal with workflow map, integration plan, delivery pod structure, pilot timeline, and budget breakdown.",
  discoveryBantCoverage: 0.82,
  openDiscoveryGaps: ["authority", "security_review"],
  podScorecard: [
    {
      member: "Sarah Mendes",
      role: "AE",
      roleInCall: "Account Executive",
      talkTimeSeconds: 86,
      talkTimeLabel: "86s",
      score: 0.88,
      label: "Strong",
      strengths:
        "Handled a skeptical opening well, used the company deck briefly, and captured budget, needs, timeline, and authority path.",
      watch: "Schedule CIO security and integration review before proposal approval.",
      areasToWork: ["Schedule CIO security and integration review before proposal approval."],
    },
  ],
  learned: [
    {
      label: "Budget",
      note: "$650K-$800K year one for first release, integrations, and dedicated pod",
    },
    {
      label: "Authority",
      note: "Dr. Lena owns operations approval, Priya owns financial model, CIO Daniel Reed approves security and integration assumptions",
    },
    {
      label: "Need",
      note: "Healthcare software solution for existing clinics, expansion readiness, and dedicated team of three to four people",
    },
    {
      label: "Timeline",
      note: "July 20 partner selection, August pilot build, October two clinic pilot, January rollout decision",
    },
    {
      label: "Sentiment (customer)",
      from: -0.55,
      to: 0.6,
      note: "Started skeptical and warmed after specific healthcare delivery framing",
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
        { label: "Next step", value: "Deliver healthcare platform proposal before next Friday" },
        { label: "Pain signals", value: "3 validated across intake, referrals, and expansion readiness" },
        { label: "Intent", value: "Healthcare software discovery and delivery pod planning" },
        { label: "Discovery coverage", value: "82% BANT · gap: CIO security review" },
      ],
    },
  ],
};

export const franchiseDemoEmailDraft: PostCallEmailDraft = {
  id: "email-carebridge-follow-up",
  audience: "client",
  to: ["lena.ortiz@carebridgehealth.com"],
  cc: ["priya.nair@carebridgehealth.com", "omar.brooks@carebridgehealth.com", "sarah.mendes@tkxel.com"],
  subject: "CareBridge healthcare software proposal next steps",
  body_markdown:
    "Hi Dr. Ortiz,\n\nThanks again for the direct conversation today. Here is what I captured from our discussion:\n\nWhat we discussed:\n- A healthcare software solution for existing clinic workflows across intake, scheduling, eligibility, referrals, and reporting\n- Expansion readiness for the next wave of clinics\n- A dedicated team of three to four people to manage ongoing software needs\n- Integration with Athena, billing, messaging, and reporting systems without replacing everything at once\n\nWhat we committed to:\n- Share a proposal with workflow map, integration plan, team structure, pilot timeline, and budget breakdown\n- Separate platform build, integration work, and managed pod cost\n- Include open questions for Daniel so the CIO review stays focused\n\nNext touch base:\n- We will follow up with proposed times for the proposal review and CIO security discussion.\n\nLooking forward,\nSarah",
  style_signals: ["concise", "healthcare-specific", "action-oriented"],
  commitments_referenced: [
    "Send healthcare software proposal before next Friday.",
    "Include workflow map, integration plan, team model, budget, and pilot timeline.",
    "Schedule CIO security and integration review.",
  ],
  status: "draft_pending_approval",
  attachments: {
    found: [
      {
        name: "Healthcare integration map",
        assetId: "demo-healthcare-integration-map",
        snippet: "Intake, scheduling, billing, messaging, reporting, and operational workspace integration lanes.",
        downloadUrl: "/knowledge/demo-healthcare-integration-map",
        previewUrl: "/knowledge/demo-healthcare-integration-map",
        fileName: "healthcare-integration-map.pdf",
        mimeType: "application/pdf",
        fileType: "PDF",
      },
    ],
    missing: [
      {
        name: "CareBridge pilot SOW",
        requiredData: "Pilot scope for two clinics, delivery plan, success metrics, integrations, and pod roles.",
        contentStudioLink:
          "/content/studio?template=pilot_sow&account=CareBridge%20Health%20Group&source=post-dc",
      },
      {
        name: "Finance ROI one-pager",
        requiredData: "Intake efficiency, referral leakage, clinic launch readiness, and year-one investment case.",
        contentStudioLink:
          "/content/studio?template=roi_one_pager&account=CareBridge%20Health%20Group&source=post-dc",
      },
    ],
  },
};

export const franchiseDemoInternalEmailDraft: PostCallEmailDraft = {
  id: "internal-email-carebridge-follow-up",
  audience: "internal",
  to: ["sales-pod@tkxel.com"],
  cc: ["sarah.mendes@tkxel.com"],
  subject: "Internal Post-DC action plan: CareBridge Health Group",
  body_markdown:
    "Internal Post-DC summary for CareBridge Health Group\n\nBANT score: 82%\nBANT details:\n- Budget: confirmed, $650K-$800K year one\n- Authority: partial, COO and finance engaged, CIO security approval pending\n- Need: confirmed, existing clinic software, expansion readiness, and dedicated delivery pod\n- Timeline: confirmed, July decision, August build, October pilot\n\nNext action items:\n- [AE] Review and send Dr. Ortiz the follow-up email with proposal timing and next-step owners.\n- [AE] Schedule CIO security and integration review.\n- [Pod] Run internal proposal debrief and assign owners for workflow map, integration plan, pod model, and ROI one-pager.\n\nRecommended next step: Deliver healthcare software proposal before next Friday.",
  style_signals: ["internal", "action-oriented", "bant-focused"],
  commitments_referenced: [
    "Review and send the follow-up email.",
    "Schedule CIO security and integration review.",
    "Assign proposal asset owners.",
  ],
  status: "draft_pending_approval",
};

export const franchiseDemoCrmTasks: PostCallTask[] = [
  {
    id: "task-carebridge-follow-up-email",
    task_type: "follow_up",
    owner: "AE",
    due_date: "2026-06-02T17:00:00.000Z",
    description: "Review and send Dr. Ortiz the follow-up email with proposal timing and next-step owners.",
    status: "pending_approval",
  },
  {
    id: "task-carebridge-cio-review",
    task_type: "schedule_next_meeting",
    owner: "AE",
    due_date: "2026-06-04T17:00:00.000Z",
    description: "Schedule CIO security and integration review before proposal approval.",
    status: "pending_approval",
  },
  {
    id: "task-carebridge-proposal-debrief",
    task_type: "internal_review",
    owner: "Pod",
    due_date: "2026-06-03T17:00:00.000Z",
    description: "Internal debrief: confirm workflow map, integration plan, delivery pod model, and ROI one-pager.",
    status: "pending_approval",
    isInternalAuto: true,
  },
];

export const franchiseDemoKbSuggestions: PostCallKbSuggestion[] = [
  {
    assetId: "demo-healthcare-integration-map",
    title: "Healthcare integration map",
    reason: "Matches the follow-up need for intake, scheduling, billing, messaging, reporting, and operational workspace integration lanes.",
    suggestedUse: "Attach to the proposal package as technical proof for the pilot architecture.",
    snippet: "Reference architecture for healthcare workflow integrations and operational workspace design.",
    score: 0.91,
  },
  {
    assetId: "demo-healthcare-delivery-pod",
    title: "Healthcare delivery pod model",
    reason: "Matches the dedicated team request and need for continuity after the first release.",
    suggestedUse: "Use as a proof point in the proposal review and delivery model narrative.",
    snippet: "Delivery model for product lead, engineering, quality, support, and architecture oversight.",
    score: 0.84,
  },
];

export const franchiseDemoJiraTicket: PostCallJiraTicket = {
  status: "draft_pending_approval",
  summary: "[DC Follow-up] CareBridge Health Group opportunity",
  description:
    "Client summary:\n- CareBridge needs a healthcare software platform for existing clinic workflows and expansion readiness.\n- The client is requesting a proposal with workflow map, integration plan, team structure, pilot timeline, and budget breakdown.\n\nClient details / needs:\n- Validated needs include existing clinic software, expansion support, and a dedicated team of three to four people.\n- The proposal should clarify intake, scheduling, eligibility, referral, billing, messaging, and reporting integrations.\n\nTimeline / POC:\n- Partner selection by July 20.\n- Discovery and design in late July.\n- Pilot build in August and two clinic pilot by October.\n\nNeeded materials:\n- Pilot SOW\n- Healthcare integration map\n- Delivery pod model\n- Finance ROI one-pager\n\nAction items:\n- Review and send Dr. Ortiz the follow-up email with proposal timing and next-step owners.\n- Schedule CIO security and integration review.\n- Confirm proposal scope, workflow map, integration plan, and reference assets.",
  issueType: "Task",
  priority: "High",
  labels: ["discovery-call", "bant-review-needed", "healthcare-ops"],
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
        "Please do. I came into this skeptical, but this is now useful. If the proposal reflects what we discussed, we can move quickly.",
      confidence: 0.9,
    },
    {
      source_type: "crm_record",
      source_id: FRANCHISE_DEMO_CALL_ID,
      snippet: "$650K-$800K year one budget; July decision; August build; October two clinic pilot.",
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
    text: "Thanks everyone. I am Sarah from Tkxel. I will keep this practical and focused on CareBridge operations.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 6,
    pauseAfterMs: 2000,
  },
  {
    text: "I will be direct. We are frustrated because we have sat through three vendor calls this month and most were generic. If this becomes another dashboard pitch, I would rather end early.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 18,
    pauseAfterMs: 3200,
  },
  {
    text: "That is fair. The copilot is suggesting I ground this with the company deck first. I will spend one minute on who Tkxel is, then we can get straight into your clinic workflows.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 32,
    pauseAfterMs: 3000,
  },
  {
    text: "Tkxel helps healthcare and regulated businesses design, build, and run software products. For this call, think of us as a delivery partner that can own product engineering, integrations, cloud, data, and a dedicated support pod.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 48,
    pauseAfterMs: 3600,
  },
  {
    text: "Okay, that is better. But we need proof that you understand healthcare operations, not just software delivery.",
    speakerId: "omar-brooks",
    speakerName: "Omar",
    speakerRole: "customer",
    offsetSeconds: 66,
    pauseAfterMs: 2400,
  },
  {
    text: "Understood. Let me ask it plainly. What needs to work better in the existing business before you think about expansion?",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 78,
    pauseAfterMs: 2300,
  },
  {
    text: "Need one is a software solution for our existing clinics. Patient intake, scheduling, eligibility checks, and referral updates are scattered across spreadsheets, calls, and old portals.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 94,
    pauseAfterMs: 3400,
  },
  {
    text: "The biggest daily pain is that front desk teams retype the same patient data into two systems. That slows intake, creates errors, and patients keep calling to ask where their referral stands.",
    speakerId: "omar-brooks",
    speakerName: "Omar",
    speakerRole: "customer",
    offsetSeconds: 112,
    pauseAfterMs: 3600,
  },
  {
    text: "That is exactly the kind of workflow we would not solve with a dashboard alone. We would map the intake journey, connect the source systems, and create one operational workspace for staff.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 130,
    pauseAfterMs: 3400,
  },
  {
    text: "Need two is expansion. We want to open six more clinics next year, but every new clinic launch feels like a custom project because workflows, checklists, and reporting are inconsistent.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 148,
    pauseAfterMs: 3400,
  },
  {
    text: "We can defend that with a phased build. First stabilize existing clinic workflows, then turn the launch process into repeatable modules for each new location.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 166,
    pauseAfterMs: 3000,
  },
  {
    text: "Need three is a dedicated team of three to four people. We do not want a team that disappears after the first release. We need product, engineering, quality, and support continuity.",
    speakerId: "priya-nair",
    speakerName: "Priya",
    speakerRole: "customer",
    offsetSeconds: 184,
    pauseAfterMs: 3600,
  },
  {
    text: "That is a good model for us. We can propose a pod with a product lead, two full stack engineers, quality support, and part time architecture oversight during the first phase.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 202,
    pauseAfterMs: 3300,
  },
  {
    text: "The fourth thing, if we can call it that, is integration. We use Athena for clinics, a separate billing tool, and a patient messaging product. We cannot rip all of that out.",
    speakerId: "omar-brooks",
    speakerName: "Omar",
    speakerRole: "customer",
    offsetSeconds: 220,
    pauseAfterMs: 3400,
  },
  {
    text: "We would not ask you to rip it out. The proposal should show integration lanes for intake, scheduling, billing, messaging, and reporting, with the new software acting as the operational layer.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 238,
    pauseAfterMs: 3400,
  },
  {
    text: "That is the first answer today that feels specific. I appreciate that you are not trying to replace every system at once.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 256,
    pauseAfterMs: 2600,
  },
  {
    text: "For budget, we have six hundred fifty thousand to eight hundred thousand approved for year one, assuming the scope includes the first release, integrations, and the dedicated team.",
    speakerId: "priya-nair",
    speakerName: "Priya",
    speakerRole: "customer",
    offsetSeconds: 272,
    pauseAfterMs: 3400,
  },
  {
    text: "That budget range is clear. I will separate platform build, integration work, and managed pod cost so finance can review each line without guessing.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 288,
    pauseAfterMs: 3000,
  },
  {
    text: "Timeline is also clear. We need partner selection by July twentieth, discovery and design in late July, pilot build in August, and a working pilot in two clinics by October.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 306,
    pauseAfterMs: 3600,
  },
  {
    text: "By January, if the pilot works, we want to start rolling it into the next wave of clinics. That is why the expansion need matters so much.",
    speakerId: "omar-brooks",
    speakerName: "Omar",
    speakerRole: "customer",
    offsetSeconds: 324,
    pauseAfterMs: 3000,
  },
  {
    text: "Who signs off after this call, and who should join the proposal review?",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 340,
    pauseAfterMs: 2300,
  },
  {
    text: "I own operations approval. Priya owns the financial model. Our CIO, Daniel Reed, needs to approve security and integration assumptions before we sign.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 354,
    pauseAfterMs: 3400,
  },
  {
    text: "Good. I will send a proposal that includes the healthcare workflow map, integration plan, team structure, pilot timeline, and budget breakdown. We can also schedule a CIO review.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 372,
    pauseAfterMs: 3400,
  },
  {
    text: "Please do. I came into this skeptical, but this is now useful. If the proposal reflects what we discussed, we can move quickly.",
    speakerId: "lena-ortiz",
    speakerName: "Dr. Lena",
    speakerRole: "customer",
    offsetSeconds: 390,
    pauseAfterMs: 3000,
  },
  {
    text: "I agree. Send it before next Friday and include the three to four person team model clearly.",
    speakerId: "priya-nair",
    speakerName: "Priya",
    speakerRole: "customer",
    offsetSeconds: 406,
    pauseAfterMs: 2600,
  },
  {
    text: "We will do that. I will also include open questions for Daniel so the security review is focused and does not slow down the July decision.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 420,
    pauseAfterMs: 2200,
  },
];

export function mergeFranchiseDemoCalls(calls: Call[], demoCall: Call = franchiseDemoCall): Call[] {
  if (calls.some((c) => c.id === FRANCHISE_DEMO_CALL_ID)) return calls;
  const hasSameAccount = calls.some(
    (c) => c.accountName?.trim().toLowerCase() === demoCall.accountName.trim().toLowerCase()
  );
  if (hasSameAccount) return calls;
  return [demoCall, ...calls];
}

export function isFranchiseDemoCall(callId: string): boolean {
  return callId === FRANCHISE_DEMO_CALL_ID;
}
