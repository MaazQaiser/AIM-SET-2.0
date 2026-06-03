import { describe, expect, it } from "vitest";
import { formatBudgetSignalLabel, formatBudgetUsd, hasBudgetAmount } from "@/lib/currency-format";

describe("currency formatting", () => {
  it("formats budget ranges as USD", () => {
    expect(formatBudgetUsd("450K to 600K")).toBe("$450K to $600K USD");
    expect(formatBudgetUsd("$450K-$600K year one")).toBe("$450K-$600K USD year one");
    expect(formatBudgetUsd("€1.2M through £1.5M")).toBe("$1.2M through $1.5M USD");
  });

  it("keeps non-budget text unchanged when there is no amount", () => {
    expect(formatBudgetUsd("Budget approved for the pilot")).toBe("Budget approved for the pilot");
  });

  it("formats budget signal labels without duplicating the value", () => {
    expect(formatBudgetSignalLabel("Budget signal: 450K to 600K", "450K to 600K")).toBe(
      "Budget signal: $450K to $600K USD"
    );
    expect(formatBudgetSignalLabel("Budget signal", "450K to 600K")).toBe(
      "Budget signal: $450K to $600K USD"
    );
  });

  it("detects existing budget amounts in labels", () => {
    expect(hasBudgetAmount("$450K-$600K USD year one")).toBe(true);
    expect(hasBudgetAmount("Budget signal")).toBe(false);
  });
});
