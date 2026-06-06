import { describe, expect, it } from "vitest";
import { groupPreDcGaps, normalizeDocumentKey } from "@/lib/content/group-pre-dc-gaps";
import type { PreDcContentGenerationGap } from "@/lib/data/hooks";

function gap(
  overrides: Partial<PreDcContentGenerationGap> & Pick<PreDcContentGenerationGap, "callId" | "name">
): PreDcContentGenerationGap {
  return {
    id: `${overrides.callId}:gap-1`,
    type: "case_study",
    priority: 2,
    status: "missing",
    reason: "Missing in KB",
    neededFor: "Social proof",
    accountName: overrides.accountName ?? "Acme",
    leadName: overrides.leadName ?? "Lead",
    studioHref: "/content/studio",
    ...overrides,
  };
}

describe("groupPreDcGaps", () => {
  it("groups leads by shared sourceArtifactId even when display names differ", () => {
    const groups = groupPreDcGaps([
      gap({
        callId: "call-1",
        name: "Healthcare case study",
        sourceArtifactId: "art-case",
        accountName: "Health Co",
        leadName: "Omar",
      }),
      gap({
        callId: "call-2",
        name: "Edtech case study",
        sourceArtifactId: "art-case",
        accountName: "Edu Co",
        leadName: "Shaun",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.leads).toHaveLength(2);
    expect(groups[0]?.name).toBe("Industry case study");
  });

  it("uses industry from neededFor for artifact-backed groups", () => {
    const groups = groupPreDcGaps([
      gap({
        callId: "call-1",
        name: "Industry case study",
        sourceArtifactId: "art-case",
        neededFor: "Social proof aligned to Transportation, Logistics and Supply Chain.",
      }),
    ]);

    expect(groups[0]?.name).toBe("Transportation, Logistics and Supply Chain case study");
  });

  it("uses normalized type/name when sourceArtifactId is missing", () => {
    expect(
      normalizeDocumentKey(
        gap({
          callId: "call-1",
          name: "Acme follow-up one-pager",
          accountName: "Acme",
          type: "one_pager",
          sourceArtifactId: undefined,
        })
      )
    ).toBe("one_pager:follow-up one-pager");
  });
});
