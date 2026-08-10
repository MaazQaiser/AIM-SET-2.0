import {
  checklistDisplayGaps,
  confirmedBantDisplayValue,
  formatChecklistDisplayGaps,
} from "@/lib/live/bant-display";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";
import { describe, expect, it } from "vitest";

const checklist: DiscoveryChecklistState = {
  callId: "call-1",
  coverage: 0.25,
  bantCoverage: 0.5,
  bant: {
    budget: "confirmed",
    authority: "unknown",
    need: "partial",
    timeline: "partial",
  },
  elapsedSeconds: 62,
  updatedAt: "2026-06-05T00:00:00Z",
  openGaps: ["authority", "need", "timeline", "next_step"],
  items: [
    {
      id: "budget",
      label: "Budget",
      tier: "bant",
      status: "confirmed",
      evidence: [{ snippet: "I have budget around 400k", confidence: 0.86, value: "400k" }],
    },
    { id: "authority", label: "Authority", tier: "bant", status: "pending", evidence: [] },
    {
      id: "need",
      label: "Need",
      tier: "bant",
      status: "partial",
      evidence: [{ snippet: "looking forward", confidence: 0.75 }],
    },
    {
      id: "timeline",
      label: "Timeline",
      tier: "bant",
      status: "partial",
      evidence: [{ snippet: "not more than three months", confidence: 0.86 }],
    },
    {
      id: "next_step",
      label: "Next step",
      tier: "secondary",
      status: "pending",
      evidence: [],
    },
  ],
};

describe("checklistDisplayGaps", () => {
  it("separates missing BANT gaps from partial BANT evidence", () => {
    expect(checklistDisplayGaps(checklist)).toEqual({
      missing: ["Authority", "Next step"],
      partial: ["Need", "Timeline"],
    });
    expect(formatChecklistDisplayGaps(checklist)).toBe(
      "Open: Authority, Next step · Partial: Need, Timeline"
    );
  });
});

describe("confirmedBantDisplayValue", () => {
  it("surfaces confirmed evidence values instead of the status label", () => {
    expect(
      confirmedBantDisplayValue({
        dimension: "budget",
        status: "confirmed",
        evidence: { value: "400k" },
      })
    ).toBe("$400k USD");

    expect(
      confirmedBantDisplayValue({
        dimension: "authority",
        status: "confirmed",
        evidence: { value: "board approval" },
      })
    ).toBe("board approval");
  });

  it("ignores confirmed-value display for partial dimensions", () => {
    expect(
      confirmedBantDisplayValue({
        dimension: "timeline",
        status: "partial",
        evidence: { value: "six weeks from kickoff" },
      })
    ).toBeNull();
  });

  it("falls back to non-generic signal values when checklist evidence has no value", () => {
    const signals: BantSignal[] = [
      {
        id: "signal-1",
        dimension: "timeline",
        label: "Timeline: six weeks from kickoff",
        timestamp: 132,
      },
    ];

    expect(
      confirmedBantDisplayValue({
        dimension: "timeline",
        status: "confirmed",
        signals,
      })
    ).toBe("six weeks from kickoff");
  });
});
