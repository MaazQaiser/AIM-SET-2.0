import { describe, expect, it } from "vitest";
import { COMPANY_STAGES, normalizeCompanyStage } from "./company-stage";

describe("normalizeCompanyStage", () => {
  it("maps known keywords to canonical stages", () => {
    expect(normalizeCompanyStage({ rawStage: "Enterprise franchise ops" })).toBe(
      "Enterprise"
    );
    expect(normalizeCompanyStage({ rawStage: "Series A startup" })).toBe("Funded Startup");
    expect(
      normalizeCompanyStage({
        rawStage: "Startup",
        fundingAmount: "$4M seed",
      })
    ).toBe("Funded Startup");
    expect(normalizeCompanyStage({ rawStage: "Early startup" })).toBe("Startup");
    expect(normalizeCompanyStage({ rawStage: "Evaluation" })).toBe("Ideation");
    expect(normalizeCompanyStage({ rawStage: "SMB lead" })).toBe("SMB");
  });

  it("returns only allowed stage values", () => {
    const stage = normalizeCompanyStage({ seed: "call-acme" });
    expect(COMPANY_STAGES).toContain(stage);
  });
});
