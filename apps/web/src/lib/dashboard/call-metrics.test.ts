import { describe, expect, it } from "vitest";
import {
  callOpportunityValue,
  formatOpportunityValue,
  parseOpportunityValue,
  todaysOpenCalls,
} from "./call-metrics";
import type { Call } from "@/types";

function call(overrides: Partial<Call>): Call {
  return {
    id: "call-acme",
    accountName: "Acme",
    scheduledAt: "2026-06-08T15:00:00.000Z",
    status: "upcoming",
    pod: [],
    briefReady: true,
    ...overrides,
  };
}

describe("parseOpportunityValue", () => {
  it("parses raw and formatted revenue values", () => {
    expect(parseOpportunityValue("6,300,000")).toBe(6_300_000);
    expect(parseOpportunityValue("$6.3M")).toBe(6_300_000);
    expect(parseOpportunityValue("$240M annual revenue")).toBe(240_000_000);
    expect(parseOpportunityValue("1.2 billion")).toBe(1_200_000_000);
  });
});

describe("callOpportunityValue", () => {
  it("prefers raw revenue when present", () => {
    expect(
      callOpportunityValue(
        call({ annualRevenueRaw: "6,300,000", annualRevenue: "$6.3M" })
      )
    ).toBe(6_300_000);
  });
});

describe("formatOpportunityValue", () => {
  it("formats visible opportunity compactly", () => {
    expect(formatOpportunityValue(6_300_000)).toBe("$6.3M");
    expect(formatOpportunityValue(960_000)).toBe("$960K");
    expect(formatOpportunityValue(0)).toBe("Unknown");
  });
});

describe("todaysOpenCalls", () => {
  it("uses discovery date/time columns for today filtering in PKT", () => {
    const calls = [
      call({
        id: "today",
        discoveryCallDatePkt: "06/08/2026",
        discoveryCallTimePkt: "8:00 PM",
      }),
      call({
        id: "tomorrow",
        discoveryCallDatePkt: "06/09/2026",
        discoveryCallTimePkt: "7:00 PM",
      }),
      call({
        id: "done",
        status: "completed",
        discoveryCallDatePkt: "06/08/2026",
      }),
    ];

    // 2026-06-08 05:00 UTC == 2026-06-08 10:00 PKT
    expect(todaysOpenCalls(calls, new Date("2026-06-08T05:00:00.000Z")).map((c) => c.id)).toEqual([
      "today",
    ]);
  });

  it("keeps late-evening PKT calls on the correct PKT calendar day", () => {
    const calls = [
      call({
        id: "evening",
        discoveryCallDatePkt: "06/08/2026",
        discoveryCallTimePkt: "11:30 PM",
      }),
    ];
    // 2026-06-08 20:00 UTC == 2026-06-09 01:00 PKT — still should match 06/08 when day is that PKT date
    expect(
      todaysOpenCalls(calls, new Date("2026-06-08T10:00:00.000Z")).map((c) => c.id)
    ).toEqual(["evening"]);
  });
});
