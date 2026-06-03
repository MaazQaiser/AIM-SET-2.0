import type { Call } from "@/types";

/** Latest completed call for post-DC review / approvals. */
export function latestPostDcHref(calls: Call[]): string {
  const latest = [...calls]
    .filter((c) => c.status === "completed")
    .sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )[0];
  return latest ? `/calls/${latest.id}/post-dc` : "/calls";
}
