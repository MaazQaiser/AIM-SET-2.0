import { describe, expect, it } from "vitest";
import { groupPostDcGaps } from "@/lib/content/group-post-dc-gaps";
import type { PostDcContentGenerationGap } from "@/lib/data/hooks";

function gap(
  overrides: Partial<PostDcContentGenerationGap> & Pick<PostDcContentGenerationGap, "callId" | "name">
): PostDcContentGenerationGap {
  return {
    id: `${overrides.callId}:${overrides.name}`,
    accountName: overrides.accountName ?? "Acme",
    leadName: overrides.leadName ?? "Lead",
    type: "case_study",
    priority: 2,
    status: "missing",
    reason: "Missing in KB",
    neededFor: "Post-call follow-up",
    studioHref: "/content/studio",
    ...overrides,
  };
}

describe("groupPostDcGaps", () => {
  it("groups leads by shared missing asset name", () => {
    const groups = groupPostDcGaps([
      gap({ callId: "call-1", name: "Healthcare case study", leadName: "Omar" }),
      gap({ callId: "call-2", name: "Healthcare case study", leadName: "Shaun" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.leads).toHaveLength(2);
    expect(groups[0]?.name).toBe("Healthcare case study");
  });
});
