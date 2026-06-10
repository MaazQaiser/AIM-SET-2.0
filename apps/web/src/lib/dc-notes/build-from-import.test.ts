import { describe, expect, it } from "vitest";
import {
  buildBriefFromPreDc,
  discoveryQuestionsFromPreDc,
  findPreDcRecordForCall,
  matchPostDcToCall,
  slugifyCompany,
  sdrHandoffSummaryFromPreDc,
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

  it("cleans company-prefixed needs and keeps SDR notes out of questions", () => {
    const qs = discoveryQuestionsFromPreDc(
      preRecord({
        [PRE_DC_HEADERS.companyName]: "Prism Data Collective",
        [PRE_DC_HEADERS.intersectionAreas]:
          "Prism Data Collective needs a unified ERP/operations platform with reliable integrations",
        [PRE_DC_HEADERS.describedNeeds]:
          "SDR Note: Outbound sequence highlighting tkxel ERP case studies. AE Note: Replace spreadsheet-driven processes.",
        [PRE_DC_HEADERS.needPreDc]: "High Level Overview",
      })
    );

    expect(qs[0]).toContain("Which parts of a unified ERP/operations platform");
    expect(qs.join(" ")).not.toContain("SDR Note");
    expect(qs.join(" ")).not.toContain("Prism Data Collective needs");
  });
});

describe("sdrHandoffSummaryFromPreDc", () => {
  it("summarizes SDR and AE handoff notes from described needs", () => {
    const rows = sdrHandoffSummaryFromPreDc(
      preRecord({
        [PRE_DC_HEADERS.intersectionAreas]:
          "Unified ERP platform for data infrastructure workflows",
        [PRE_DC_HEADERS.describedNeeds]:
          "SDR Note: Outbound sequence to Nadia highlighting tkxel ERP and integration case studies; positive reply within a week. AE Note: Replace spreadsheet-driven processes and clarify the data model.",
        [PRE_DC_HEADERS.discoveryCallDatePkt]: "06/10/2026",
        [PRE_DC_HEADERS.discoveryCallTimePkt]: "7:00 pm",
      })
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "How they were approached",
          value: expect.stringContaining("Outbound sequence to Nadia"),
        }),
        expect.objectContaining({
          label: "Client signal",
          value: "Unified ERP platform for data infrastructure workflows",
        }),
        expect.objectContaining({
          label: "Committed for this call",
          value: expect.stringContaining("Replace spreadsheet-driven processes"),
        }),
      ])
    );
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
