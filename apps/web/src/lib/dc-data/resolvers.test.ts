import { describe, expect, it, beforeEach } from "vitest";
import { resolveCalls, hasCsvData } from "./resolvers";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { PRE_DC_HEADERS } from "@/types/dc-notes";

describe("resolvers", () => {
  beforeEach(() => {
    useDcImportsStore.setState({
      preDcRecords: [],
      postDcRecords: [],
      calls: [],
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
});
