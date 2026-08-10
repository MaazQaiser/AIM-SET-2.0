import type { Call } from "@/types";

export interface PrepReadyOverride {
  readyAt?: string;
}

export type PrepReadyByCallId = Record<string, PrepReadyOverride | undefined>;

export function isPrepMarkedReady(
  callId: string | undefined,
  prepReadyByCallId: PrepReadyByCallId
): boolean {
  return Boolean(callId && prepReadyByCallId[callId]);
}

export function applyPrepReadyToCall(
  call: Call,
  prepReadyByCallId: PrepReadyByCallId
): Call {
  if (!isPrepMarkedReady(call.id, prepReadyByCallId) || call.briefReady) {
    return call;
  }

  return {
    ...call,
    briefReady: true,
  };
}

export function applyPrepReadyToCalls(
  calls: Call[],
  prepReadyByCallId: PrepReadyByCallId
): Call[] {
  if (Object.keys(prepReadyByCallId).length === 0) return calls;
  return calls.map((call) => applyPrepReadyToCall(call, prepReadyByCallId));
}
