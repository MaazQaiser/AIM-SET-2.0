import { describe, expect, it } from "vitest";
import {
  isPostDcLandingVisible,
  isPostDcProposalVisible,
  visiblePostDcMoreItems,
  visiblePostDcTabs,
} from "@/components/post-dc/post-dc-tab-config";
import { resolveDealSignals, resolveLeadStage, isNotFitLeadStage } from "@/lib/post-dc/deal-signals";
import type { PostCallReview } from "@/lib/brief-types";

describe("visiblePostDcTabs", () => {
  it("hides proposal and landing for not-a-fit deals", () => {
    const tabs = visiblePostDcTabs("Not a fit");
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("proposal");
    expect(ids).not.toContain("landing");
  });
});

describe("visiblePostDcMoreItems", () => {
  it("hides proposal and landing for not-a-fit deals", () => {
    const items = visiblePostDcMoreItems("Not a fit");
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("proposal");
    expect(ids).not.toContain("landing");
    expect(ids).toContain("transcript");
    expect(ids).toContain("before");
  });

  it("hides proposal for nurture deals", () => {
    const items = visiblePostDcMoreItems("Nurture");
    expect(items.map((i) => i.id)).not.toContain("proposal");
  });

  it("shows proposal for opportunity deals", () => {
    const items = visiblePostDcMoreItems("Opportunity");
    expect(items.map((i) => i.id)).toContain("proposal");
  });
});

describe("isPostDcProposalVisible", () => {
  it("hides proposal for not-a-fit deals", () => {
    expect(isPostDcProposalVisible("Not a fit")).toBe(false);
  });

  it("shows proposal for opportunity deals", () => {
    expect(isPostDcProposalVisible("Opportunity")).toBe(true);
  });
});

describe("isPostDcLandingVisible", () => {
  it("hides landing for not-a-fit deals", () => {
    expect(isPostDcLandingVisible("Not a fit")).toBe(false);
  });

  it("shows landing for opportunity deals", () => {
    expect(isPostDcLandingVisible("Opportunity")).toBe(true);
  });
});

describe("visiblePostDcTabs legacy", () => {
  it("hides proposal for nurture in tab config", () => {
    const tabs = visiblePostDcTabs("Nurture");
    expect(tabs.map((t) => t.id)).not.toContain("proposal");
  });
});

describe("resolveDealSignals", () => {
  it("reads dealSignals from review when present", () => {
    const review: PostCallReview = {
      headline: "Opportunity · High Potential · Software Engineering",
      summary: [],
      podScorecard: [],
      learned: [],
      dealSignals: {
        leadStage: "Opportunity",
        engagementModel: "Fixed Cost",
      },
    };
    expect(resolveDealSignals(review).engagementModel).toBe("Fixed Cost");
    expect(resolveLeadStage(review)).toBe("Opportunity");
  });

  it("detects not-a-fit lead stage", () => {
    expect(isNotFitLeadStage("Not a fit")).toBe(true);
    expect(isNotFitLeadStage("Opportunity")).toBe(false);
  });
});
