import { describe, expect, it, beforeEach } from "vitest";
import { detectInstantBant } from "@/lib/live/instant-bant-detect";
import { useLiveCall } from "@/stores/use-live-call";

describe("detectInstantBant", () => {
  it("detects budget from customer speech with dollar amount", () => {
    const signals = detectInstantBant(
      "For budget, we have six hundred fifty thousand to eight hundred thousand approved for year one.",
      "customer",
      272
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].dimension).toBe("budget");
  });

  it("detects budget with numeric shorthand", () => {
    const signals = detectInstantBant(
      "We carved $450K for the platform budget this year.",
      "customer",
      95
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].dimension).toBe("budget");
    expect(signals[0].value).toContain("$450K");
  });

  it("detects timeline with month references", () => {
    const signals = detectInstantBant(
      "Timeline is clear. We need partner selection by July twentieth, pilot build in August, and a working pilot by October.",
      "customer",
      306
    );
    expect(signals.some((s) => s.dimension === "timeline")).toBe(true);
  });

  it("detects timeline with quarter references", () => {
    const signals = detectInstantBant(
      "We want a Q3 pilot with ten franchisees and production go-live by Q1 next year.",
      "customer",
      108
    );
    expect(signals.some((s) => s.dimension === "timeline")).toBe(true);
  });

  it("detects authority from decision-maker mention", () => {
    const signals = detectInstantBant(
      "I own operations approval. Our CIO Daniel Reed needs to approve security assumptions before we sign.",
      "customer",
      354
    );
    expect(signals.some((s) => s.dimension === "authority")).toBe(true);
  });

  it("detects authority with CFO reference", () => {
    const signals = detectInstantBant(
      "The CFO owns approval and can approve it next week.",
      "customer",
      66
    );
    expect(signals.some((s) => s.dimension === "authority")).toBe(true);
  });

  it("detects need from pain-point language", () => {
    const signals = detectInstantBant(
      "Patient intake, scheduling, and eligibility are scattered across spreadsheets — we need a software solution for our existing clinics.",
      "customer",
      94
    );
    expect(signals.some((s) => s.dimension === "need")).toBe(true);
  });

  it("ignores AE/sales rep speech", () => {
    const signals = detectInstantBant(
      "We have a budget of $500K approved for this project.",
      "ae",
      50
    );
    expect(signals).toHaveLength(0);
  });

  it("ignores very short text", () => {
    const signals = detectInstantBant("budget", "customer", 10);
    expect(signals).toHaveLength(0);
  });

  it("returns at most one signal per dimension", () => {
    const signals = detectInstantBant(
      "Our budget is $400K allocated. We also earmarked $200K for integrations.",
      "customer",
      100
    );
    const budgetSignals = signals.filter((s) => s.dimension === "budget");
    expect(budgetSignals).toHaveLength(1);
  });
});

describe("instant BANT detection timing via store", () => {
  beforeEach(() => {
    useLiveCall.getState().reset();
  });

  it("BANT signal appears in the same synchronous tick as appendTranscriptEvent", () => {
    const store = useLiveCall.getState();
    expect(store.bantSignals).toHaveLength(0);

    // Append a customer transcript event mentioning budget
    store.appendTranscriptEvent({
      id: "seg-budget-1",
      speakerId: "buyer-1",
      speakerName: "Priya",
      speakerRole: "customer",
      text: "For budget, we have six hundred fifty thousand to eight hundred thousand approved for year one.",
      timestamp: 272,
    });

    // BANT signal should already be in the store — no async, no delay
    const state = useLiveCall.getState();
    expect(state.bantSignals.length).toBeGreaterThanOrEqual(1);
    expect(state.bantSignals.some((s) => s.dimension === "budget")).toBe(true);
  });

  it("timeline signal appears immediately when customer mentions dates", () => {
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-timeline-1",
      speakerId: "buyer-2",
      speakerName: "Dr. Lena",
      speakerRole: "customer",
      text: "Timeline is clear. We need partner selection by July twentieth, pilot build in August, and a working pilot by October.",
      timestamp: 306,
    });

    const state = useLiveCall.getState();
    expect(state.bantSignals.some((s) => s.dimension === "timeline")).toBe(true);
  });

  it("authority signal appears immediately when customer mentions decision-maker", () => {
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-auth-1",
      speakerId: "buyer-3",
      speakerName: "Dr. Lena",
      speakerRole: "customer",
      text: "I own operations approval. Our CIO Daniel Reed needs to approve security and integration assumptions.",
      timestamp: 354,
    });

    const state = useLiveCall.getState();
    expect(state.bantSignals.some((s) => s.dimension === "authority")).toBe(true);
  });

  it("no signal fires for AE transcript events", () => {
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-ae-1",
      speakerId: "ae-1",
      speakerName: "Sarah",
      speakerRole: "ae",
      text: "We can propose a budget of $500K for the platform build.",
      timestamp: 100,
    });

    const state = useLiveCall.getState();
    expect(state.bantSignals).toHaveLength(0);
  });

  it("backend signal replaces instant signal via dedup key", () => {
    // Instant signal fires first
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-budget-dedup",
      speakerId: "buyer-1",
      speakerName: "Priya",
      speakerRole: "customer",
      text: "We carved $450K for the platform budget this year.",
      timestamp: 95,
    });

    let state = useLiveCall.getState();
    expect(state.bantSignals.some((s) => s.dimension === "budget")).toBe(true);

    // Backend responds with a richer signal at the same timestamp
    state.addBantSignal({
      id: "backend-budget-95",
      dimension: "budget",
      label: "Budget signal: $450K approved for year one",
      value: "$450K approved for year one",
      snippet: "We carved $450K for the platform budget this year.",
      timestamp: 95,
    });

    state = useLiveCall.getState();
    const budgetSignals = state.bantSignals.filter((s) => s.dimension === "budget");
    // Should be deduped to one signal (merged by dimension:timestamp key)
    expect(budgetSignals).toHaveLength(1);
    // The richer backend signal should win
    expect(budgetSignals[0].value).toBe("$450K approved for year one");
  });
});
