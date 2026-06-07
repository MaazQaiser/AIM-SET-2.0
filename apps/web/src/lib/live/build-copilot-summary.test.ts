import { describe, expect, it, vi } from "vitest";
import { buildCopilotInsights } from "@/lib/live/build-copilot-insights";
import {
  buildRunningSummaryLines,
  clampLines,
} from "@/lib/live/build-running-summary-lines";
import {
  dedupePainSignals,
  painQuote,
  painSummary,
  painsAreSimilar,
} from "@/lib/live/pain-display";

describe("buildRunningSummaryLines", () => {
  it("stays empty before the live transcript starts", () => {
    const lines = buildRunningSummaryLines({
      accountName: "Acme Corp",
      leadName: "Jane Doe",
      intent: { label: "cost_reduction", display: "Cost reduction", confidence: 0.8 },
      intentLabel: undefined,
      checklist: {
        bantCoverage: 0.5,
        bant: { budget: "partial", authority: "unknown", need: "confirmed", timeline: "unknown" },
        items: [],
        openGaps: [],
      } as never,
      transcript: [],
    });

    expect(lines).toEqual([]);
  });

  it("builds discrete lines without pain points", () => {
    const lines = buildRunningSummaryLines({
      accountName: "Acme Corp",
      leadName: "Jane Doe",
      intent: { label: "cost_reduction", display: "Cost reduction", confidence: 0.8 },
      intentLabel: undefined,
      checklist: {
        bantCoverage: 0.5,
        bant: { budget: "partial", authority: "unknown", need: "confirmed", timeline: "unknown" },
        items: [],
        openGaps: [],
      } as never,
      transcript: [
        {
          id: "1",
          speakerId: "c1",
          speakerName: "Customer",
          speakerRole: "customer",
          text: "We need better reporting.",
          timestamp: 1,
        },
      ],
    });

    expect(lines[0]).toContain("Jane Doe at Acme Corp");
    expect(lines.some((line) => line.includes("buyer seems focused"))).toBe(true);
    expect(lines.some((line) => line.includes("BANT coverage"))).toBe(true);
    expect(lines.some((line) => line.includes("The latest thing they said"))).toBe(true);
    expect(lines.some((line) => line.toLowerCase().includes("pain"))).toBe(false);
  });

  it("describes discovery gaps in conversational language", () => {
    const lines = buildRunningSummaryLines({
      accountName: "Debug Fixed Cost",
      leadName: "Buyer",
      intent: { label: "technical_deep_dive", display: "Technical deep dive", confidence: 0.8 },
      intentLabel: undefined,
      checklist: {
        bantCoverage: 0.88,
        bant: {
          budget: "confirmed",
          authority: "partial",
          need: "confirmed",
          timeline: "confirmed",
        },
        items: [
          { id: "authority", label: "Authority", status: "partial", tier: "bant" },
          { id: "next_step", label: "Next step", status: "pending", tier: "bant" },
        ],
        openGaps: ["authority", "next_step"],
      } as never,
      transcript: [
        {
          id: "1",
          speakerId: "c1",
          speakerName: "Customer",
          speakerRole: "customer",
          text: "Please include CFO-level ROI and a clear decision process before the next review.",
          timestamp: 1,
        },
      ],
    }).join(" ");

    expect(lines).toContain("The buyer seems focused on a technical deep dive.");
    expect(lines).toContain(
      "You've got about 88% BANT coverage; the main open piece is the next step and authority is partly there but still needs specifics."
    );
    expect(lines).toContain("The latest thing they said was");
    expect(lines).not.toContain("Still to cover:");
    expect(lines).not.toContain("Partially covered:");
  });

  it("clamps lines when not expanded", () => {
    const lines = ["a", "b", "c", "d", "e", "f"];
    expect(clampLines(lines, 5, false)).toEqual(["a", "b", "c", "d", "e"]);
    expect(clampLines(lines, 5, true)).toEqual(lines);
  });
});

describe("buildCopilotInsights", () => {
  it("maps insight types to line items with actions", () => {
    const onAcceptNudge = vi.fn();
    const onDismissNudge = vi.fn();

    const items = buildCopilotInsights({
      customerSentiment: {
        label: "Evaluating",
        guidance: "Keep discovery open.",
      } as never,
      nudges: [
        {
          id: "n1",
          message: "Ask about budget owner.",
          role: "ae",
          timestamp: 1,
          citation: { id: "c1", title: "Transcript", type: "transcript" },
        },
        {
          id: "n2",
          message: "Who signs off on spend?",
          role: "ae",
          timestamp: 2,
          source: "discovery-checklist",
          checklistItemId: "authority",
          citation: { id: "c2", title: "Transcript", type: "transcript" },
        },
      ],
      objections: [
        {
          id: "o1",
          objection_text: "Too expensive",
          counter_points: ["Quantify ROI", "Compare to status quo"],
          timestamp: 1,
        },
      ],
      unansweredQuestions: [{ id: "q1", text: "What is your timeline?" }],
      onAcceptNudge,
      onDismissNudge,
    });

    expect(items).toHaveLength(5);
    expect(items[0].label).toBe("Customer signal");
    expect(items[0].kind).toBe("insight");
    expect(items[0].onGotIt).toBeUndefined();
    expect(items[1].label).toBe("Live signal");
    expect(items[1].kind).toBe("insight");
    expect(items[1].gotItLabel).toBe("Got it");
    expect(items[1].onGotIt).toBeDefined();
    expect(items[1].onDismiss).toBeDefined();
    expect(items[2].label).toBe("BANT gap");
    expect(items[2].kind).toBe("question");
    expect(items[3].details).toEqual(["Quantify ROI", "Compare to status quo"]);
    expect(items[3].gotItLabel).toBe("Flag deal");
    expect(items[4].gotItLabel).toBe("Copy");
  });
});

describe("pain display helpers", () => {
  const emergentPain = {
    id: "p1",
    text: "Honestly it's a nightmare — operators live in spreadsheets, every POS integration is different, and I have zero real-time visibility into unit-level profitability.",
    evidence:
      "Honestly it's a nightmare — operators live in spreadsheets, every POS integration is different, and I have zero real-time visibility into unit-level profitability.",
    source: "emergent" as const,
    confidence: 0.9,
    timestamp: 1,
  };

  it("summarizes long emergent quotes into concise bullets", () => {
    const summary = painSummary(emergentPain);
    expect(summary).not.toMatch(/^honestly/i);
    expect(summary.length).toBeLessThanOrEqual(101);
    expect(summary).toContain("operators live in spreadsheets");
  });

  it("uses the concrete pain instead of a vague emotional tail", () => {
    const summary = painSummary({
      id: "p2",
      text: "that's the pain keeping me up at night.",
      evidence:
        "Manual brand-standard audits are the bottleneck before we open the next regional wave — that's the pain keeping me up at night.",
      source: "emergent",
      confidence: 0.9,
      timestamp: 2,
    });

    expect(summary).toBe(
      "Manual brand-standard audits are the bottleneck before we open the next regional wave"
    );
  });

  it("returns evidence when it differs from summary text", () => {
    expect(
      painQuote({
        id: "p1",
        text: "Ops teams lack real-time visibility",
        evidence: "Our operators live in spreadsheets all day.",
        source: "emergent",
        confidence: 0.9,
        timestamp: 1,
      })
    ).toBe("Our operators live in spreadsheets all day.");
  });

  it("dedupes repeated pain signals", () => {
    const pains = dedupePainSignals([
      emergentPain,
      { ...emergentPain, id: "p2" },
      {
        id: "p3",
        text: "Manual brand-standard audits are the bottleneck before we open the next regional wave",
        evidence: "Manual brand-standard audits are the bottleneck before we open the next regional wave",
        source: "emergent",
        confidence: 0.8,
        timestamp: 2,
      },
      {
        id: "p4",
        text: "Manual brand-standard audits are the bottleneck before we open the next regional wave — that's the pain keeping me up.",
        evidence:
          "Manual brand-standard audits are the bottleneck before we open the next regional wave — that's the pain keeping me up.",
        source: "emergent",
        confidence: 0.8,
        timestamp: 3,
      },
    ]);

    expect(pains).toHaveLength(2);
    expect(painsAreSimilar(pains[0].text, emergentPain.text)).toBe(true);
  });
});
