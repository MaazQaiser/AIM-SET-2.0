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
    expect(brief.aiSummary).toContain("cloud migration");
    expect(brief.pains.length).toBeGreaterThan(0);
    expect(brief.objections).toEqual([]);
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
