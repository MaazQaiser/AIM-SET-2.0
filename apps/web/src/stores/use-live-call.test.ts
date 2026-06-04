import { beforeEach, describe, expect, it } from "vitest";
import { applyApiDemoResult, applyClientDemoSegment } from "@/lib/demo/client-live-call-demo";
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
    useLiveCall.getState().updateSentiment(0.25, -0.5, {
      direction: "negative",
      from_score: 0.1,
      to_score: -0.5,
      timestamp: 40,
      message: "Customer sentiment shifted toward negative.",
    });

    const state = useLiveCall.getState();
    expect(state.sentimentAE).toBe(0.25);
    expect(state.sentimentCustomer).toBe(-0.5);
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
          payload: { ae: 0.1, customer: -0.5, shift: null },
        },
      ],
    });

    expect(useLiveCall.getState().sentimentCustomer).toBe(-0.5);
    expect(useLiveCall.getState().sentimentAE).toBe(0.1);
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
});
