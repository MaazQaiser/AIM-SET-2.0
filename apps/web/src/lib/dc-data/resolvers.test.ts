import { describe, expect, it, beforeEach } from "vitest";
import { resolveCalls, hasCsvData, resolvePostCallReview } from "./resolvers";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { PRE_DC_HEADERS } from "@/types/dc-notes";

describe("resolvers", () => {
  beforeEach(() => {
    useDcImportsStore.setState({
      preDcRecords: [],
      postDcRecords: [],
      calls: [],
      statusOverridesByCallId: {},
      briefsByCallId: {},
      postReviewsByCallId: {},
      preDcFileName: null,
      postDcFileName: null,
      importedAt: null,
      importVersion: 0,
    });
  });

  it("returns empty when no CSV imported", () => {
    expect(hasCsvData()).toBe(false);
    expect(resolveCalls()).toEqual([]);
  });

  it("uses CSV calls when preDcRecords present", () => {
    useDcImportsStore.setState({
      preDcRecords: [
        {
          id: "pre-1",
          fields: {
            [PRE_DC_HEADERS.companyName]: "TestCo",
            [PRE_DC_HEADERS.discoveryCallDatePkt]: "5/20/2026",
          },
        },
      ],
    });
    expect(hasCsvData()).toBe(true);
    const calls = resolveCalls();
    expect(calls.some((c) => c.accountName === "TestCo")).toBe(true);
  });

  it("marks calls with Post-DC review evidence as completed", () => {
    useDcImportsStore.setState({
      calls: [
        {
          id: "call-review-ready",
          accountName: "Review Ready",
          scheduledAt: "2026-06-08T07:00:00.000Z",
          status: "upcoming",
          briefReady: true,
          pod: [],
        },
      ],
      postReviewsByCallId: {
        "call-review-ready": {
          headline: "Wrapped",
          summary: ["Call completed."],
          podScorecard: [],
          learned: [],
        },
      },
    });

    expect(resolveCalls()[0]?.status).toBe("completed");
  });

  it("lets the demo reset override Post-DC evidence back to Pre-DC", () => {
    useDcImportsStore.setState({
      calls: [
        {
          id: "call-review-ready",
          accountName: "Review Ready",
          scheduledAt: "2026-06-08T07:00:00.000Z",
          status: "completed",
          briefReady: true,
          pod: [],
        },
      ],
      statusOverridesByCallId: { "call-review-ready": "upcoming" },
      postReviewsByCallId: {
        "call-review-ready": {
          headline: "Wrapped",
          summary: ["Call completed."],
          podScorecard: [],
          learned: [],
        },
      },
    });

    expect(resolveCalls()[0]?.status).toBe("upcoming");
    expect(resolvePostCallReview("call-review-ready")).toBeNull();
  });
});
