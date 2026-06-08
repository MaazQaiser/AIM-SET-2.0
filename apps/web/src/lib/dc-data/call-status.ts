import type { CallStatus } from "@/types";

const CALL_STATUSES = new Set<CallStatus>(["upcoming", "live", "completed", "no-show"]);

export function normalizeCallStatus(status: unknown): CallStatus | undefined {
  return typeof status === "string" && CALL_STATUSES.has(status as CallStatus)
    ? (status as CallStatus)
    : undefined;
}

export function resolveMergedCallStatus({
  apiStatus,
  localStatus,
  overrideStatus,
}: {
  apiStatus?: unknown;
  localStatus?: unknown;
  overrideStatus?: unknown;
}): CallStatus {
  const override = normalizeCallStatus(overrideStatus);
  if (override) return override;

  const api = normalizeCallStatus(apiStatus);
  const local = normalizeCallStatus(localStatus);
  if (api === "completed" || local === "completed") return "completed";
  if (api === "no-show" || local === "no-show") return "no-show";
  if (api === "live" || local === "live") return "live";
  return local ?? api ?? "upcoming";
}
