import { describe, expect, it } from "vitest";
import {
  applyPrepReadyToCall,
  applyPrepReadyToCalls,
  isPrepMarkedReady,
} from "./prep-ready-overrides";
import type { Call } from "@/types";

function call(overrides: Partial<Call>): Call {
  return {
    id: "call-1",
    accountName: "Acme",
    scheduledAt: "2026-06-10T14:00:00.000Z",
    status: "upcoming",
    pod: [],
    briefReady: false,
    ...overrides,
  };
}

describe("prep ready overrides", () => {
  it("marks only explicitly ready calls as brief ready", () => {
    const ready = call({ id: "ready-call" });
    const pending = call({ id: "pending-call" });
    const overrides = {
      "ready-call": { readyAt: "2026-06-10T13:00:00.000Z" },
    };

    expect(isPrepMarkedReady("ready-call", overrides)).toBe(true);
    expect(isPrepMarkedReady("pending-call", overrides)).toBe(false);
    expect(applyPrepReadyToCall(ready, overrides).briefReady).toBe(true);
    expect(applyPrepReadyToCalls([ready, pending], overrides).map((item) => item.briefReady)).toEqual([
      true,
      false,
    ]);
  });
});
