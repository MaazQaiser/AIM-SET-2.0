import { beforeEach, describe, expect, it } from "vitest";
import { applyApiDemoResult, applyClientDemoSegment } from "@/lib/demo/client-live-call-demo";
import { FRANCHISE_DEMO_TRANSCRIPT } from "@/lib/demo/franchise-ai-platform-demo";
import { useLiveCall } from "@/stores/use-live-call";
import type { TranscriptEvent } from "@/types";

const baseEvent: TranscriptEvent = {
  id: "segment-1",
  speakerId: "buyer-1",
  speakerName: "Sam Buyer",
  speakerRole: "customer",
  text: "I'm not sure how this helps with manual audits.",
  timestamp: 35,
};

describe("useLiveCall live page state regressions", () => {
  beforeEach(() => {
    useLiveCall.getState().reset();
  });

  it("merges analyzed transcript enrichment instead of dropping duplicate segment ids", () => {
    const store = useLiveCall.getState();
    store.appendTranscriptEvent(baseEvent);
    store.appendTranscriptEvent({
      ...baseEvent,
      keywords: ["manual audits"],
      sentiment: "negative",
      signalType: "objection_raised",
    });

    const transcript = useLiveCall.getState().transcript;
    expect(transcript).toHaveLength(1);
    expect(transcript[0].speakerName).toBe("Sam Buyer");
    expect(transcript[0].sentiment).toBe("negative");
    expect(transcript[0].keywords).toEqual(["manual audits"]);
    expect(transcript[0].signalType).toBe("objection_raised");
  });

  it("applies live sentiment payloads used by the metrics rail", () => {
    useLiveCall.getState().updateSentiment(
      0.25,
      -0.5,
      {
        direction: "negative",
        from_score: 0.1,
        to_score: -0.5,
        timestamp: 40,
        message: "Customer sentiment shifted toward negative.",
      },
      {
        label: "Empathetic discovery",
        guidance: "Mirror the buyer's words, then ask one concise follow-up.",
        tone: "positive",
        source: "live-call-agent",
      },
      {
        label: "Decision risk",
        guidance: "Clarify the doubt before advancing.",
        tone: "negative",
        source: "live-call-agent",
      }
    );

    const state = useLiveCall.getState();
    expect(state.sentimentAE).toBe(0.25);
    expect(state.salesRepTone?.label).toBe("Empathetic discovery");
    expect(state.sentimentCustomer).toBe(-0.5);
    expect(state.customerSentiment?.label).toBe("Decision risk");
    expect(state.sentimentShift?.direction).toBe("negative");
  });

  it("keeps pain-point assistant nudges available for the assistant column", () => {
    useLiveCall.getState().addNudge({
      id: "pain-nudge-1",
      message:
        'Customer raised: "manual compliance audits are a bottleneck" - align next questions to this pain.',
      role: "ae",
      timestamp: 68,
      citation: {
        id: "cite-1",
        title: "Pain point detected",
        type: "transcript",
        excerpt: "manual compliance audits are a bottleneck",
      },
    });

    expect(useLiveCall.getState().pendingNudges[0].message).toContain("manual compliance audits");
  });

  it("applies sentiment from API demo fallback websocket messages", () => {
    applyApiDemoResult({
      ws_messages: [
        {
          type: "sentiment",
          payload: {
            ae: 0.1,
            customer: -0.5,
            shift: null,
            salesRepTone: {
              label: "Focused discovery",
              guidance: "Keep the question short and tied to the buyer's last point.",
              tone: "positive",
              source: "live-call-agent",
            },
            customerSentiment: {
              label: "Pain exposed",
              guidance: "Validate impact and connect the next answer to that outcome.",
              tone: "negative",
              source: "live-call-agent",
            },
          },
        },
      ],
    });

    expect(useLiveCall.getState().sentimentCustomer).toBe(-0.5);
    expect(useLiveCall.getState().sentimentAE).toBe(0.1);
    expect(useLiveCall.getState().salesRepTone?.label).toBe("Focused discovery");
    expect(useLiveCall.getState().customerSentiment?.label).toBe("Pain exposed");
  });

  it("keeps sentiment signals from API demo fallback websocket messages", () => {
    applyApiDemoResult({
      ws_messages: [
        {
          type: "sentiment",
          payload: {
            ae: 0,
            customer: -0.5,
            shift: null,
            signal: {
              id: "sentiment-segment-1",
              label: "Customer sentiment: concern",
              timestamp: 19,
              speakerRole: "customer",
              speakerName: "Alex",
              tone: "negative",
              score: -0.5,
              snippet: "I'm not sure that you will be able to help us.",
            },
          },
        },
        {
          type: "sentiment_signal",
          payload: {
            id: "sentiment-segment-2",
            label: "Customer sentiment: upbeat",
            timestamp: 30,
            speakerRole: "customer",
            speakerName: "Alex",
            tone: "positive",
            score: 0.5,
            snippet: "This is exactly what we need.",
          },
        },
      ],
    });

    const state = useLiveCall.getState();
    expect(state.sentimentSignals).toHaveLength(2);
    expect(state.sentimentSignals[0].tone).toBe("negative");
    expect(state.sentimentSignals[0].snippet).toContain("not sure");
    expect(state.sentimentSignals[1].tone).toBe("positive");
  });

  it("normalizes legacy AE sentiment signal labels", () => {
    useLiveCall.getState().addSentimentSignal({
      id: "sentiment-ae-legacy",
      label: "AE sentiment: concern",
      timestamp: 12,
      speakerRole: "ae",
      speakerName: "Sarah",
      tone: "negative",
      score: -0.5,
      snippet: "This is getting risky.",
    });

    const [signal] = useLiveCall.getState().sentimentSignals;
    expect(signal.label).toBe("Sales rep tone: concern");
    expect(signal.label).not.toContain("AE");
  });

  it("applies enriched transcript and sentiment from API demo fallback messages", () => {
    applyApiDemoResult({
      ws_messages: [
        {
          type: "transcript",
          payload: {
            ...baseEvent,
            keywords: ["manual audits"],
            sentiment: "negative",
            signalType: "objection_raised",
          },
        },
        {
          type: "sentiment",
          payload: { ae: 0, customer: -0.65 },
        },
      ],
    });

    const state = useLiveCall.getState();
    expect(state.transcript[0].sentiment).toBe("negative");
    expect(state.transcript[0].keywords).toEqual(["manual audits"]);
    expect(state.sentimentCustomer).toBe(-0.65);
  });

  it("applies BANT signal arrays from API demo fallback messages", () => {
    applyApiDemoResult({
      ws_messages: [
        {
          type: "bant_signal",
          payload: [
            {
              id: "budget-signal-1",
              dimension: "budget",
              label: "Budget signal: $450K to $600K",
              value: "$450K to $600K",
              timestamp: 95,
            },
          ],
        },
      ],
    });

    const state = useLiveCall.getState();
    expect(state.bantSignals).toHaveLength(1);
    expect(state.bantSignals[0].dimension).toBe("budget");
    expect(state.bantSignals[0].value).toBe("$450K to $600K");
  });

  it("dedupes generic BANT signal annotations when checklist evidence arrives", () => {
    const store = useLiveCall.getState();
    store.addBantSignal({
      id: "generic-budget",
      dimension: "budget",
      label: "Budget Signal",
      timestamp: 54,
    });
    store.addBantSignal({
      id: "rich-budget",
      dimension: "budget",
      label: "Budget signal: i have budget around",
      value: "i have budget around",
      snippet: "i have budget around",
      timestamp: 54,
    });
    store.addBantSignal({
      id: "generic-timeline",
      dimension: "timeline",
      label: "Timeline Signal",
      timestamp: 62,
    });
    store.addBantSignal({
      id: "rich-timeline",
      dimension: "timeline",
      label: "Timeline signal: not more than three months",
      value: "not more than three months",
      snippet: "the deadline will be not more than three months",
      timestamp: 62,
    });

    const state = useLiveCall.getState();
    expect(state.bantSignals).toHaveLength(2);
    expect(state.bantSignals.map((signal) => signal.dimension)).toEqual(["budget", "timeline"]);
    expect(state.bantSignals[0].label).toContain("i have budget around");
    expect(state.bantSignals[1].label).toContain("not more than three months");
  });

  it("ignores malformed checklist payloads from partial API demo fallback results", () => {
    applyApiDemoResult({
      checklist: {},
      ws_messages: [
        {
          type: "sentiment",
          payload: { ae: 0, customer: -0.5 },
        },
      ],
    });

    const state = useLiveCall.getState();
    expect(state.checklistState).toBeNull();
    expect(state.sentimentCustomer).toBe(-0.5);
  });

  it("keeps client-only demo sentiment negative on customer pain", () => {
    applyClientDemoSegment("frontera-franchise-group", 3, {
      text: "Honestly it's a nightmare — operators live in spreadsheets with zero visibility.",
      speakerId: "marcus-chen",
      speakerName: "Marcus",
      speakerRole: "customer",
      offsetSeconds: 52,
    });

    const state = useLiveCall.getState();
    expect(state.sentimentCustomer).toBeLessThan(0);
    expect(state.pendingNudges.some((n) => n.message.includes("Customer raised"))).toBe(true);
  });

  it("updates budget BANT signal and checklist when client states budget (line 16)", () => {
    // Seed earlier lines so checklist is initialized (requires lineIndex >= 3)
    for (let i = 0; i <= 15; i++) {
      applyClientDemoSegment("frontera-franchise-group", i, {
        text: `filler line ${i}`,
        speakerId: "ae-sarah",
        speakerName: "Sarah",
        speakerRole: "ae",
        offsetSeconds: i * 10,
      });
    }

    // Line 16: Priya states the budget
    applyClientDemoSegment("frontera-franchise-group", 16, {
      text: "For budget, we have six hundred fifty thousand to eight hundred thousand approved for year one, assuming the scope includes the first release, integrations, and the dedicated team.",
      speakerId: "priya-nair",
      speakerName: "Priya",
      speakerRole: "customer",
      offsetSeconds: 272,
    });

    const state = useLiveCall.getState();

    // BANT signal should exist for budget (instant or demo-scripted)
    const budgetSignals = state.bantSignals.filter((s) => s.dimension === "budget");
    expect(budgetSignals.length).toBeGreaterThanOrEqual(1);

    // Checklist should mark budget as confirmed
    expect(state.checklistState).not.toBeNull();
    expect(state.checklistState!.bant.budget).toBe("confirmed");

    // Budget should NOT be in openGaps
    expect(state.checklistState!.openGaps).not.toContain("budget");
  });

  it("updates timeline BANT signal and checklist when client states timeline (lines 18-19)", () => {
    // Seed earlier lines so checklist is initialized
    for (let i = 0; i <= 17; i++) {
      applyClientDemoSegment("frontera-franchise-group", i, {
        text: `filler line ${i}`,
        speakerId: "ae-sarah",
        speakerName: "Sarah",
        speakerRole: "ae",
        offsetSeconds: i * 10,
      });
    }

    // Line 18: Dr. Lena states the timeline
    applyClientDemoSegment("frontera-franchise-group", 18, {
      text: "Timeline is also clear. We need partner selection by July twentieth, discovery and design in late July, pilot build in August, and a working pilot in two clinics by October.",
      speakerId: "lena-ortiz",
      speakerName: "Dr. Lena",
      speakerRole: "customer",
      offsetSeconds: 306,
    });

    let state = useLiveCall.getState();

    // BANT signal should exist for timeline (instant or demo-scripted)
    const timelineSignals = state.bantSignals.filter((s) => s.dimension === "timeline");
    expect(timelineSignals.length).toBeGreaterThanOrEqual(1);

    // Checklist should mark timeline as confirmed
    expect(state.checklistState).not.toBeNull();
    expect(state.checklistState!.bant.timeline).toBe("confirmed");

    // Timeline should NOT be in openGaps
    expect(state.checklistState!.openGaps).not.toContain("timeline");

    // Line 19: Omar adds January rollout detail
    applyClientDemoSegment("frontera-franchise-group", 19, {
      text: "By January, if the pilot works, we want to start rolling it into the next wave of clinics. That is why the expansion need matters so much.",
      speakerId: "omar-brooks",
      speakerName: "Omar",
      speakerRole: "customer",
      offsetSeconds: 324,
    });

    state = useLiveCall.getState();
    // Timeline should still be confirmed after the follow-up line
    expect(state.checklistState!.bant.timeline).toBe("confirmed");
  });

  it("shows budget and timeline in checklist display after both are confirmed", () => {
    // Apply the actual budget line
    useLiveCall.getState().reset();
    for (let i = 0; i <= 18; i++) {
      const lines: Record<number, { text: string; speakerId: string; speakerName: string; speakerRole: "customer" | "ae"; offsetSeconds: number }> = {
        16: {
          text: "For budget, we have six hundred fifty thousand to eight hundred thousand approved for year one.",
          speakerId: "priya-nair",
          speakerName: "Priya",
          speakerRole: "customer",
          offsetSeconds: 272,
        },
        18: {
          text: "Timeline is also clear. We need partner selection by July twentieth, pilot build in August, and a working pilot by October.",
          speakerId: "lena-ortiz",
          speakerName: "Dr. Lena",
          speakerRole: "customer",
          offsetSeconds: 306,
        },
      };
      const line = lines[i] ?? {
        text: `filler line ${i}`,
        speakerId: "ae-sarah",
        speakerName: "Sarah",
        speakerRole: "ae" as const,
        offsetSeconds: i * 10,
      };
      applyClientDemoSegment("frontera-franchise-group", i, line);
    }

    const state = useLiveCall.getState();
    expect(state.checklistState!.bant.budget).toBe("confirmed");
    expect(state.checklistState!.bant.timeline).toBe("confirmed");

    // Neither budget nor timeline should appear as open gaps
    expect(state.checklistState!.openGaps).not.toContain("budget");
    expect(state.checklistState!.openGaps).not.toContain("timeline");
  });

  it("full demo playback: budget and timeline update progressively with real transcript lines", () => {
    const lines = FRANCHISE_DEMO_TRANSCRIPT;

    useLiveCall.getState().reset();
    useLiveCall.getState().setCallId("frontera-franchise-group");

    // Before line 3: no checklist at all
    for (let i = 0; i < 3; i++) {
      applyClientDemoSegment("frontera-franchise-group", i, lines[i]);
    }
    expect(useLiveCall.getState().checklistState).toBeNull();

    // Lines 3-15: checklist exists but budget+timeline should still be unknown/pending
    for (let i = 3; i <= 15; i++) {
      applyClientDemoSegment("frontera-franchise-group", i, lines[i]);
    }
    let state = useLiveCall.getState();
    expect(state.checklistState).not.toBeNull();
    expect(state.checklistState!.bant.budget).toBe("unknown");
    expect(state.checklistState!.bant.timeline).toBe("unknown");
    expect(state.checklistState!.openGaps).toContain("budget");
    expect(state.checklistState!.openGaps).toContain("timeline");

    // Line 16: Priya states budget — should flip to confirmed
    applyClientDemoSegment("frontera-franchise-group", 16, lines[16]);
    state = useLiveCall.getState();
    expect(state.checklistState!.bant.budget).toBe("confirmed");
    expect(state.checklistState!.openGaps).not.toContain("budget");
    // Budget signal should exist (instant or demo-scripted)
    expect(state.bantSignals.some((s) => s.dimension === "budget")).toBe(true);
    // Budget evidence should be stored in checklist
    const budgetItem = state.checklistState!.items.find((i) => i.id === "budget");
    expect(budgetItem?.status).toBe("confirmed");
    expect(budgetItem?.evidence?.length).toBeGreaterThan(0);
    expect(budgetItem?.evidence?.[0]?.value).toBe("$650K to $800K year one");

    // Line 17: Sarah responds — budget should stay confirmed
    applyClientDemoSegment("frontera-franchise-group", 17, lines[17]);
    state = useLiveCall.getState();
    expect(state.checklistState!.bant.budget).toBe("confirmed");

    // Line 18: Dr. Lena states timeline — should flip to confirmed
    applyClientDemoSegment("frontera-franchise-group", 18, lines[18]);
    state = useLiveCall.getState();
    expect(state.checklistState!.bant.timeline).toBe("confirmed");
    expect(state.checklistState!.openGaps).not.toContain("timeline");
    // Timeline signal should exist (instant or demo-scripted)
    expect(state.bantSignals.some((s) => s.dimension === "timeline")).toBe(true);
    // Timeline evidence should be stored
    const timelineItem = state.checklistState!.items.find((i) => i.id === "timeline");
    expect(timelineItem?.status).toBe("confirmed");
    expect(timelineItem?.evidence?.[0]?.value).toBe("July 20 decision, August build, October pilot");

    // Line 19: Omar extends timeline — should stay confirmed with updated evidence
    applyClientDemoSegment("frontera-franchise-group", 19, lines[19]);
    state = useLiveCall.getState();
    expect(state.checklistState!.bant.timeline).toBe("confirmed");
    const updatedTimeline = state.checklistState!.items.find((i) => i.id === "timeline");
    expect(updatedTimeline?.evidence?.[0]?.value).toBe("January rollout into next clinic wave");

    // Play remaining lines — budget and timeline should remain confirmed
    for (let i = 20; i < lines.length; i++) {
      applyClientDemoSegment("frontera-franchise-group", i, lines[i]);
    }
    state = useLiveCall.getState();
    expect(state.checklistState!.bant.budget).toBe("confirmed");
    expect(state.checklistState!.bant.timeline).toBe("confirmed");
    expect(state.checklistState!.openGaps).not.toContain("budget");
    expect(state.checklistState!.openGaps).not.toContain("timeline");

    // BANT coverage should be high
    expect(state.checklistState!.bantCoverage).toBeGreaterThanOrEqual(0.75);
  });

  it("stale API checklist still merges budget confirmation into newer client state", () => {
    // Directly set up a checklist state where budget is still unknown at elapsedSeconds=200
    const store = useLiveCall.getState();
    store.applyChecklistUpdate({
      callId: "frontera-franchise-group",
      coverage: 0.25,
      bantCoverage: 0.25,
      bant: { budget: "unknown", authority: "unknown", need: "confirmed", timeline: "unknown" },
      items: [
        { id: "budget", label: "Budget", tier: "bant", status: "pending", evidence: [] },
        { id: "authority", label: "Authority", tier: "bant", status: "pending", evidence: [] },
        { id: "need", label: "Need", tier: "bant", status: "confirmed", evidence: [{ snippet: "clinic workflows", confidence: 0.85 }] },
        { id: "timeline", label: "Timeline", tier: "bant", status: "pending", evidence: [] },
      ],
      elapsedSeconds: 200,
      openGaps: ["budget", "authority", "timeline"],
      updatedAt: new Date().toISOString(),
    });
    expect(useLiveCall.getState().checklistState!.bant.budget).toBe("unknown");

    // Now a stale API response arrives for an earlier segment with budget confirmed
    applyApiDemoResult({
      checklist: {
        callId: "frontera-franchise-group",
        coverage: 0.5,
        bantCoverage: 0.5,
        bant: { budget: "confirmed", authority: "unknown", need: "confirmed", timeline: "unknown" },
        items: [
          {
            id: "budget",
            label: "Budget",
            tier: "bant",
            status: "confirmed",
            evidence: [{ snippet: "$650K to $800K year one", value: "$650K to $800K year one", confidence: 0.85 }],
          },
          { id: "authority", label: "Authority", tier: "bant", status: "pending", evidence: [] },
          { id: "need", label: "Need", tier: "bant", status: "confirmed", evidence: [{ snippet: "clinic workflows", confidence: 0.85 }] },
          { id: "timeline", label: "Timeline", tier: "bant", status: "pending", evidence: [] },
        ],
        elapsedSeconds: 180, // stale: lower than current 200
        openGaps: ["authority", "timeline"],
        updatedAt: new Date().toISOString(),
      },
      ws_messages: [],
    });

    const afterState = useLiveCall.getState();
    // Budget should be merged even though checklist was stale
    expect(afterState.checklistState!.bant.budget).toBe("confirmed");
    // Budget should be removed from openGaps
    expect(afterState.checklistState!.openGaps).not.toContain("budget");
    // Budget BANT signal should have been extracted
    expect(afterState.bantSignals.some((s) => s.dimension === "budget")).toBe(true);
  });

  it("stale API checklist merges timeline confirmation without regressing budget", () => {
    // Client has processed through line 19, budget+timeline confirmed client-side
    const lines = FRANCHISE_DEMO_TRANSCRIPT;
    for (let i = 0; i <= 19; i++) {
      applyClientDemoSegment("frontera-franchise-group", i, lines[i]);
    }
    const beforeState = useLiveCall.getState();
    expect(beforeState.checklistState!.bant.budget).toBe("confirmed");
    expect(beforeState.checklistState!.bant.timeline).toBe("confirmed");

    // Stale API response for line 18 arrives with only timeline confirmed (not budget)
    applyApiDemoResult({
      checklist: {
        callId: "frontera-franchise-group",
        coverage: 0.4,
        bantCoverage: 0.25,
        bant: { budget: "unknown", authority: "unknown", need: "confirmed", timeline: "confirmed" },
        items: [
          { id: "budget", label: "Budget", tier: "bant", status: "pending", evidence: [] },
          { id: "authority", label: "Authority", tier: "bant", status: "pending", evidence: [] },
          { id: "need", label: "Need", tier: "bant", status: "confirmed", evidence: [] },
          {
            id: "timeline",
            label: "Timeline",
            tier: "bant",
            status: "confirmed",
            evidence: [{ snippet: "July decision", value: "July 20", confidence: 0.85 }],
          },
        ],
        elapsedSeconds: 200, // stale
        openGaps: ["budget", "authority"],
        updatedAt: new Date().toISOString(),
      },
      ws_messages: [],
    });

    const afterState = useLiveCall.getState();
    // Budget must NOT regress from confirmed back to unknown
    expect(afterState.checklistState!.bant.budget).toBe("confirmed");
    // Timeline should stay confirmed
    expect(afterState.checklistState!.bant.timeline).toBe("confirmed");
  });
});
