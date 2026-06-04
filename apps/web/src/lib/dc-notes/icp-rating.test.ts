import { describe, expect, it } from "vitest";
import { companyRatingForCall } from "./icp-rating";

describe("companyRatingForCall", () => {
  it("returns an integer between 1 and 8", () => {
    const ids = ["call-acme", "call-wardenwatch", "call-beta-corp"];
    for (const id of ids) {
      const score = companyRatingForCall({ id, icpBucket: "Sweet spot" });
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(8);
      expect(Number.isInteger(score)).toBe(true);
    }
  });

  it("is stable for the same call id", () => {
    const a = companyRatingForCall({ id: "call-test", icpBucket: "Potential" });
    const b = companyRatingForCall({ id: "call-test", icpBucket: "Potential" });
    expect(a).toBe(b);
  });
});
