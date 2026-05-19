/**
 * Typed API client for the DC Copilot Python backend.
 * All server-side data fetches go through this module.
 * Client-side fetches use TanStack Query + these functions via the BFF routes.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { tags?: string[] }
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    next: options?.tags ? { tags: options.tags } : undefined,
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Calls ────────────────────────────────────────────────────
export async function getCalls() {
  return apiFetch<import("@/types").Call[]>("/api/v1/calls", { tags: ["calls"] });
}

export async function getCall(callId: string) {
  return apiFetch<import("@/types").Call>(`/api/v1/calls/${callId}`, {
    tags: [`call:${callId}`],
  });
}

// ── Knowledge base ───────────────────────────────────────────
export async function getKBAssets() {
  return apiFetch<import("@/types").KBAsset[]>("/api/v1/kb/assets", { tags: ["kb"] });
}

// ── Coaching ─────────────────────────────────────────────────
export async function getCoachingInsights() {
  return apiFetch<import("@/types").CoachingInsight[]>("/api/v1/coaching/insights", {
    tags: ["coaching"],
  });
}
