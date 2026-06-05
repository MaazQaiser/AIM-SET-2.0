import { describe, expect, it } from "vitest";
import { checklistDisplayGaps, formatChecklistDisplayGaps } from "@/lib/live/bant-display";
import type { DiscoveryChecklistState } from "@dc-copilot/types";

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
