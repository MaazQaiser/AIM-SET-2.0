import { describe, expect, it } from "vitest";
import { isDiscoveryCallUpcoming, parseDiscoveryDateTime } from "./parse-discovery";

describe("parseDiscoveryDateTime", () => {
  it("parses US date with time", () => {
    const iso = parseDiscoveryDateTime("5/19/2026", "10:30 AM");
    expect(iso).toBeTruthy();
    if (!iso) throw new Error("Expected an ISO datetime");
    const d = new Date(iso);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  it("returns null for empty date", () => {
    expect(parseDiscoveryDateTime("", "10:00 AM")).toBeNull();
  });
});

describe("isDiscoveryCallUpcoming", () => {
  it("treats far-future dates as upcoming", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isDiscoveryCallUpcoming(future.toISOString())).toBe(true);
  });
});
