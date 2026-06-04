import { describe, expect, it } from "vitest";
import {
  buildBriefFromPreDc,
  discoveryQuestionsFromPreDc,
  findPreDcRecordForCall,
  matchPostDcToCall,
  slugifyCompany,
} from "./build-from-import";
import { PRE_DC_HEADERS } from "@/types/dc-notes";
import type { PostDCRecord, PreDCRecord } from "@/types/dc-notes";

function preRecord(overrides: Record<string, string>): PreDCRecord {
  const fields: Record<string, string> = {
    [PRE_DC_HEADERS.companyName]: "Acme Corp",
    [PRE_DC_HEADERS.leadName]: "Jane Doe",
    [PRE_DC_HEADERS.intersectionAreas]: "cloud migration",
    ...overrides,
  };
  return { id: "pre-1", fields };
}

describe("slugifyCompany", () => {
  it("slugifies company name", () => {
    expect(slugifyCompany("Acme Corp")).toBe("call-acme-corp");
  });
});

describe("findPreDcRecordForCall", () => {
  it("matches demo call id to ingested company slug", () => {
    const records = [preRecord({ [PRE_DC_HEADERS.companyName]: "Frontera Franchise Group" })];
    expect(findPreDcRecordForCall(records, "frontera-franchise-group")?.id).toBe("pre-1");
    expect(findPreDcRecordForCall(records, "call-frontera-franchise-group")?.id).toBe("pre-1");
  });
});

describe("buildBriefFromPreDc", () => {
  it("builds aiSummary from intersection and needs", () => {
    const brief = buildBriefFromPreDc(
      preRecord({
        [PRE_DC_HEADERS.describedNeeds]: "Need faster compliance reporting",
        [PRE_DC_HEADERS.relevanceToTkxel]: "Strong fit for fintech",
      }),
      "call-acme-corp"
    );
    expect(brief.aiSummary).toContain("faster compliance reporting");
    expect(brief.aiSummary).not.toContain("cloud migration");
    expect(brief.pains[0]?.text).toBe("Needs/content is not identified yet.");
    expect(brief.pains.length).toBeGreaterThan(0);
    expect(brief.objections).toEqual([]);
  });

  it("removes outreach timeline details from fallback summary text", () => {
    const brief = buildBriefFromPreDc(
      preRecord({
        [PRE_DC_HEADERS.companyName]: "WardenWatch",
        [PRE_DC_HEADERS.companyDescription]: "WardenWatch is a public-safety software company.",
        [PRE_DC_HEADERS.describedNeeds]:
          "Brian responded positively and expressed openness to a call, but later clarified that his initial reply went out before he had bandwidth. After multiple follow-up attempts via email and phone, Brian re-engaged and mentioned that he would need investor funding to move forward, though he expressed strong confidence in WardenWatch's revenue potential. Scheduling was discussed, Brian requested an NDA and company details, and the meeting has been confirmed.",
      }),
      "call-wardenwatch"
    );

    expect(brief.aiSummary).toContain("WardenWatch is a public-safety software company");
    expect(brief.aiSummary).toContain("investor funding to move forward");
    expect(brief.aiSummary).not.toContain("Brian responded");
    expect(brief.aiSummary).not.toContain("bandwidth");
    expect(brief.aiSummary).not.toContain("follow-up attempts");
    expect(brief.aiSummary).not.toContain("NDA");
    expect(brief.pains.some((pain) => pain.text === "investor funding to move forward")).toBe(false);
    expect(brief.pains[0]?.text).toBe("Needs/content is not identified yet.");
  });
});

describe("discoveryQuestionsFromPreDc", () => {
  it("generates questions from tech stack", () => {
    const qs = discoveryQuestionsFromPreDc(
      preRecord({ [PRE_DC_HEADERS.techStacks]: "AWS, Kubernetes" })
    );
    expect(qs.some((q) => q.includes("stack"))).toBe(true);
  });
});

describe("matchPostDcToCall", () => {
  it("matches post record by company name in context", () => {
    const calls = [{ id: "call-acme-corp", accountName: "Acme Corp", scheduledAt: "", status: "upcoming" as const, briefReady: true, pod: [] }];
    const pre = [preRecord({})];
    const post: PostDCRecord = {
      id: "post-1",
      fields: { "Bottom Line Context": "Follow-up with Acme Corp leadership" },
    };
    expect(matchPostDcToCall(post, calls, pre)).toBe("call-acme-corp");
  });
});
