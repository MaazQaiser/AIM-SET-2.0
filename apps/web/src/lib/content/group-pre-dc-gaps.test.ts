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
  it("groups leads by shared sourceArtifactId and content context", () => {
    const groups = groupPreDcGaps([
      gap({
        callId: "call-1",
        name: "Healthcare case study",
        sourceArtifactId: "art-case",
        accountName: "Health Co",
        leadName: "Omar",
        neededFor: "Social proof aligned to Healthcare.",
      }),
      gap({
        callId: "call-2",
        name: "Healthcare proof story",
        sourceArtifactId: "art-case",
        accountName: "Edu Co",
        leadName: "Shaun",
        neededFor: "Social proof aligned to Healthcare.",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.leads).toHaveLength(2);
    expect(groups[0]?.name).toBe("Healthcare case study");
  });

  it("splits the same artifact id when the needed context differs", () => {
    const groups = groupPreDcGaps([
      gap({
        callId: "call-1",
        name: "Healthcare case study",
        sourceArtifactId: "art-case",
        neededFor: "Social proof aligned to Healthcare.",
      }),
      gap({
        callId: "call-2",
        name: "Retail case study",
        sourceArtifactId: "art-case",
        neededFor: "Social proof aligned to Retail.",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.name).sort()).toEqual(["Healthcare case study", "Retail case study"]);
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

  it("includes context in artifact-backed document keys", () => {
    expect(
      normalizeDocumentKey(
        gap({
          callId: "call-1",
          name: "Healthcare case study",
          sourceArtifactId: "art-case",
          neededFor: "Social proof aligned to Healthcare.",
        })
      )
    ).toBe("artifact:art-case:healthcare");
  });

  it("uses the displayed representative lead for reason and neededFor", () => {
    const groups = groupPreDcGaps([
      gap({
        callId: "call-2",
        accountName: "Zulu Co",
        name: "Healthcare case study",
        sourceArtifactId: "art-case",
        neededFor: "Social proof aligned to Healthcare.",
        reason: "Reason from Zulu",
      }),
      gap({
        callId: "call-1",
        accountName: "Alpha Co",
        name: "Healthcare case study",
        sourceArtifactId: "art-case",
        neededFor: "Social proof aligned to Healthcare.",
        reason: "Reason from Alpha",
      }),
    ]);

    expect(groups[0]?.reason).toBe("Reason from Alpha");
    expect(groups[0]?.leads[0]?.accountName).toBe("Alpha Co");
  });
});
