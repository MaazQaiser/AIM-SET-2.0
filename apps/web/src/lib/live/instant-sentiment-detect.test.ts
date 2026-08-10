import { describe, expect, it, beforeEach } from "vitest";
import { detectInstantSentiment } from "@/lib/live/instant-sentiment-detect";
import { useLiveCall } from "@/stores/use-live-call";

describe("detectInstantSentiment", () => {
  it("detects anger when customer mentions another vendor", () => {
    const result = detectInstantSentiment(
      "if you don't want to continue just let me know i can look for another vendor",
      "customer",
      400,
      0
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(-0.3);
    expect(result!.cue.tone).toBe("negative");
  });

  it("detects frustration when customer says they are repeating", () => {
    const result = detectInstantSentiment(
      "I am repeating this requirement for the third time, are you even listening?",
      "customer",
      200,
      0
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(-0.3);
    expect(result!.cue.tone).toBe("negative");
  });

  it("detects frustration with already told/mentioned patterns", () => {
    const result = detectInstantSentiment(
      "As I mentioned earlier, I already told you what we need. Why are you asking again and again?",
      "customer",
      150,
      0
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(-0.3);
    expect(result!.cue.tone).toBe("negative");
  });

  it("detects threat to escalate to senior/manager", () => {
    const result = detectInstantSentiment(
      "ask him why don't you bring some senior salesperson with you i think you misunderstood my whole requirement",
      "customer",
      300,
      0
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(-0.3);
    expect(result!.cue.tone).toBe("negative");
  });

  it("returns high frustration label for combined angry + threat patterns", () => {
    const result = detectInstantSentiment(
      "This is unacceptable! I want to speak to your manager. I am done with this waste of time!",
      "customer",
      500,
      0
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(-0.5);
    expect(result!.cue.label).toBe("Frustrated buyer");
  });

  it("detects pain-point language as mild negative", () => {
    const result = detectInstantSentiment(
      "Our intake process is a nightmare with zero visibility into referral status.",
      "customer",
      100,
      0
    );
    expect(result).not.toBeNull();
    expect(result!.cue.tone).toBe("negative");
  });

  it("detects positive recovery", () => {
    const result = detectInstantSentiment(
      "That is exactly what we needed. Let's move forward with the proposal.",
      "customer",
      600,
      -0.5
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.cue.tone).toBe("positive");
    expect(result!.shift?.direction).toBe("positive");
  });

  it("generates negative shift when moving from positive to negative", () => {
    const result = detectInstantSentiment(
      "I am frustrated, you already told me this and I keep repeating my requirement.",
      "customer",
      300,
      0.5
    );
    expect(result).not.toBeNull();
    expect(result!.shift).toBeDefined();
    expect(result!.shift!.direction).toBe("negative");
    expect(result!.shift!.from_score).toBe(0.5);
  });

  it("ignores AE/sales rep speech", () => {
    const result = detectInstantSentiment(
      "I understand your frustration, let me get my senior on the call.",
      "ae",
      100,
      0
    );
    expect(result).toBeNull();
  });

  it("ignores neutral customer speech", () => {
    const result = detectInstantSentiment(
      "Can you share the project timeline with me please?",
      "customer",
      100,
      0
    );
    expect(result).toBeNull();
  });

  it("ignores very short text", () => {
    const result = detectInstantSentiment("ok sure", "customer", 10, 0);
    expect(result).toBeNull();
  });
});

describe("instant sentiment via store", () => {
  beforeEach(() => {
    useLiveCall.getState().reset();
  });

  it("sentiment updates in the same tick when customer is angry", () => {
    // Start with positive sentiment
    useLiveCall.getState().updateSentiment(0, 0.5, null, undefined, {
      label: "Engaged buyer",
      guidance: "Keep going",
      tone: "positive",
      source: "fallback",
    });
    expect(useLiveCall.getState().customerSentiment?.label).toBe("Engaged buyer");

    // Customer says something angry
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-angry-1",
      speakerId: "buyer-1",
      speakerName: "Asjad",
      speakerRole: "customer",
      text: "ask him why don't you bring some senior salesperson with you i think you misunderstood my whole requirement if you don't want to continue just let me know i can look for another vendor",
      timestamp: 300,
    });

    // Sentiment should already be negative — no async, no delay
    const state = useLiveCall.getState();
    expect(state.sentimentCustomer).toBeLessThan(0);
    expect(state.customerSentiment?.tone).toBe("negative");
    expect(state.customerSentiment?.label).not.toBe("Engaged buyer");
  });

  it("sentiment updates when customer keeps repeating requirements", () => {
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-repeat-1",
      speakerId: "buyer-1",
      speakerName: "Client",
      speakerRole: "customer",
      text: "I am repeating this requirement again and again. As I mentioned before, we need a dedicated team of four people. How many times do I have to say this?",
      timestamp: 250,
    });

    const state = useLiveCall.getState();
    expect(state.sentimentCustomer).toBeLessThan(0);
    expect(state.customerSentiment?.tone).toBe("negative");
  });

  it("sentiment recovers when customer turns positive", () => {
    // Set negative first
    useLiveCall.getState().updateSentiment(0, -0.6, null, undefined, {
      label: "Frustrated buyer",
      guidance: "Recover",
      tone: "negative",
      source: "instant-detect",
    });

    // Customer says something positive
    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-recover-1",
      speakerId: "buyer-1",
      speakerName: "Client",
      speakerRole: "customer",
      text: "That is exactly what we needed, this makes sense. Let's move forward with the proposal.",
      timestamp: 400,
    });

    const state = useLiveCall.getState();
    expect(state.sentimentCustomer).toBeGreaterThan(0);
    expect(state.customerSentiment?.tone).toBe("positive");
    expect(state.sentimentShift?.direction).toBe("positive");
  });

  it("does not change sentiment for AE speech", () => {
    useLiveCall.getState().updateSentiment(0, 0.5, null, undefined, {
      label: "Engaged buyer",
      guidance: "Keep going",
      tone: "positive",
      source: "fallback",
    });

    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-ae-angry",
      speakerId: "ae-1",
      speakerName: "Sarah",
      speakerRole: "ae",
      text: "I understand your frustration, this is unacceptable on our end.",
      timestamp: 300,
    });

    const state = useLiveCall.getState();
    expect(state.sentimentCustomer).toBe(0.5);
    expect(state.customerSentiment?.label).toBe("Engaged buyer");
  });

  it("does not change sentiment for neutral customer speech", () => {
    useLiveCall.getState().updateSentiment(0, 0.5, null, undefined, {
      label: "Engaged buyer",
      guidance: "Keep going",
      tone: "positive",
      source: "fallback",
    });

    useLiveCall.getState().appendTranscriptEvent({
      id: "seg-neutral",
      speakerId: "buyer-1",
      speakerName: "Client",
      speakerRole: "customer",
      text: "Can you show me the integration architecture diagram?",
      timestamp: 200,
    });

    const state = useLiveCall.getState();
    expect(state.sentimentCustomer).toBe(0.5);
    expect(state.customerSentiment?.label).toBe("Engaged buyer");
  });
});
