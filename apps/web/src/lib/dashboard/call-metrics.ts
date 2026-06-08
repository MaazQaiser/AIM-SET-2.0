import { isSameDay, startOfDay } from "date-fns";
import { parseDiscoveryDateTime } from "@/lib/dc-notes/parse-discovery";
import type { Call } from "@/types";

export function isOpenCall(call: Call): boolean {
  return call.status === "upcoming" || call.status === "live";
}

export function callScheduleDate(call: Call): Date {
  if (call.discoveryCallDatePkt?.trim()) {
    const parsed = parseDiscoveryDateTime(
      call.discoveryCallDatePkt,
      call.discoveryCallTimePkt ?? ""
    );
    if (parsed) return new Date(parsed);
  }
  return new Date(call.scheduledAt);
}

export function isCallOnDay(call: Call, day: Date = new Date()): boolean {
  const at = callScheduleDate(call);
  return Number.isFinite(at.getTime()) && isSameDay(at, startOfDay(day));
}

export function todaysOpenCalls(calls: Call[], day: Date = new Date()): Call[] {
  return calls
    .filter((call) => isOpenCall(call) && isCallOnDay(call, day))
    .sort((a, b) => callScheduleDate(a).getTime() - callScheduleDate(b).getTime());
}

export function upcomingOpenCalls(calls: Call[], day: Date = new Date()): Call[] {
  const floor = startOfDay(day).getTime();
  return calls
    .filter((call) => {
      if (!isOpenCall(call)) return false;
      const at = callScheduleDate(call);
      if (!Number.isFinite(at.getTime())) return false;
      return call.status === "live" || at.getTime() >= floor;
    })
    .sort((a, b) => callScheduleDate(a).getTime() - callScheduleDate(b).getTime());
}

export function parseOpportunityValue(raw?: string): number {
  const text = raw?.trim().toLowerCase();
  if (!text) return 0;

  const match = text.replace(/,/g, "").match(/[\d.]+/);
  if (!match) return 0;

  const value = Number.parseFloat(match[0]);
  if (!Number.isFinite(value) || value <= 0) return 0;

  if (/(billion|bn|b)\b/.test(text)) return value * 1_000_000_000;
  if (/(million|mm|m)\b/.test(text)) return value * 1_000_000;
  if (/(thousand|k)\b/.test(text)) return value * 1_000;
  return value;
}

export function callOpportunityValue(call: Call): number {
  return parseOpportunityValue(call.annualRevenueRaw) || parseOpportunityValue(call.annualRevenue);
}

export function formatOpportunityValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Unknown";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

export function totalOpportunityValue(calls: Call[]): number {
  return calls.reduce((sum, call) => sum + callOpportunityValue(call), 0);
}
