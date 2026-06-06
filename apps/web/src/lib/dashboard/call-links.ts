import type { Call } from "@/types";

/** Primary call detail route: pre-DC brief, live workspace, or post-DC review. */
export function callDetailsHref(call: Call): string {
  if (call.status === "completed") {
    return `/calls/${call.id}/post-dc`;
  }
  if (call.status === "live") {
    return `/calls/${call.id}/live`;
  }
  return `/calls/${call.id}`;
}

/** Latest completed call for post-DC review / approvals. */
export function latestPostDcHref(calls: Call[]): string {
  const latest = [...calls]
    .filter((c) => c.status === "completed")
    .sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )[0];
  return latest ? `/calls/${latest.id}/post-dc` : "/calls";
}
