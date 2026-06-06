import { describe, expect, it } from "vitest";
import type { PreDcContentGenerationGap } from "@/lib/data/hooks";
import type { PreDcGenerationGroup } from "@/lib/content/group-pre-dc-gaps";
import {
  attachKbMatchesToGroups,
  extractIndustryFromGap,
  findKbMatchesForGroup,
  resolveContextualGroupTitle,
} from "@/lib/content/suggestion-context";
import type { KBAsset } from "@/types";

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
    accountName: "Acme",
    leadName: "Lead",
    studioHref: "/content/studio",
    ...overrides,
  };
}

describe("resolveContextualGroupTitle", () => {
  it("includes industry in artifact-backed case study title", () => {
    const title = resolveContextualGroupTitle([
      gap({
        callId: "call-1",
        name: "Industry case study",
        sourceArtifactId: "art-case",
        industry: "Transportation, Logistics and Supply Chain",
      }),
    ]);

    expect(title.name).toBe("Transportation, Logistics and Supply Chain case study");
    expect(title.industryLabel).toBe("Transportation, Logistics and Supply Chain");
  });

  it("falls back to generic artifact title without industry context", () => {
    const title = resolveContextualGroupTitle([
      gap({
        callId: "call-1",
        name: "Industry case study",
        sourceArtifactId: "art-case",
      }),
    ]);

    expect(title.name).toBe("Industry case study");
  });
});

describe("extractIndustryFromGap", () => {
  it("prefers call industry over neededFor", () => {
    expect(
      extractIndustryFromGap(
        gap({
          callId: "call-1",
          name: "Case study",
          industry: "Healthcare",
          neededFor: "Anchor the conversation for Retail.",
        })
      )
    ).toBe("Healthcare");
  });
});

describe("findKbMatchesForGroup", () => {
  const kbAsset = (overrides: Partial<KBAsset> & Pick<KBAsset, "id" | "title" | "type">): KBAsset =>
    ({
      tags: [],
      uploadedAt: "2026-01-01",
      ...overrides,
    }) as KBAsset;

  it("ranks industry-aligned case studies higher", () => {
    const group: PreDcGenerationGroup = {
      id: "artifact:art-case",
      name: "Transportation, Logistics and Supply Chain case study",
      type: "case_study",
      priority: 2,
      status: "missing",
      reason: "Missing",
      neededFor: "Social proof",
      studioHref: "/content",
      industryLabel: "Transportation, Logistics and Supply Chain",
      leads: [],
    };

    const matches = findKbMatchesForGroup(group, [
      kbAsset({ id: "1", title: "Generic logistics win", type: "case-study", tags: ["transportation"] }),
      kbAsset({ id: "2", title: "Retail customer story", type: "case-study", tags: ["retail"] }),
    ]);

    expect(matches[0]?.id).toBe("1");
  });
});

describe("attachKbMatchesToGroups", () => {
  it("adds kbMatches to each group", () => {
    const groups = attachKbMatchesToGroups(
      [
        {
          id: "artifact:art-deck",
          name: "Services overview deck",
          type: "deck",
          priority: 1,
          status: "missing",
          reason: "Missing",
          neededFor: "Anchor",
          studioHref: "/content",
          leads: [],
        },
      ],
      [
        {
          id: "deck-1",
          title: "Overview deck",
          type: "deck",
          tags: [],
          uploadedAt: "2026-01-01",
          version: 1,
        } as KBAsset,
      ]
    );

    expect(groups[0]?.kbMatches).toHaveLength(1);
    expect(groups[0]?.kbMatches?.[0]?.title).toBe("Overview deck");
  });
});
