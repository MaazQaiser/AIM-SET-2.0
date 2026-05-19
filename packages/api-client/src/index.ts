import type { Call } from "@dc-copilot/types";
import type { CallBrief } from "@dc-copilot/types/brief";

export interface ApiClientOptions {
  baseUrl: string;
  userId: string;
  tenantId?: string;
}

async function apiFetch<T>(opts: ApiClientOptions, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${opts.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": opts.userId,
      ...(opts.tenantId ? { "x-tenant-id": opts.tenantId } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function createApiClient(opts: ApiClientOptions) {
  return {
    getCalls: () => apiFetch<Call[]>(opts, "/api/v1/calls"),
    getCall: (id: string) => apiFetch<Call>(opts, `/api/v1/calls/${id}`),
    getBrief: (id: string) => apiFetch<CallBrief>(opts, `/api/v1/calls/${id}/brief`),
    generateBrief: (id: string) =>
      apiFetch<unknown>(opts, `/api/v1/calls/${id}/generate-brief`, { method: "POST" }),
    getKbAssets: () => apiFetch<unknown[]>(opts, "/api/v1/kb/assets"),
  };
}
