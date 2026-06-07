"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_STALE_TIME_MS } from "@/lib/data/query-cache";
import type { AgentConfig, AgentId } from "@/types/agents";

const CONFIG_FETCH_TIMEOUT_MS = 12_000;

async function fetchAgentConfig(agentId: AgentId): Promise<AgentConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/agents/${agentId}/config`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      let message = text || `Failed to load settings (${res.status})`;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // use raw text
      }
      throw new Error(message);
    }
    return (await res.json()) as AgentConfig;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "Request timed out. Check that the API is running on port 8000 (API_URL in apps/web/.env.local)."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function useAgentConfig(agentId: AgentId) {
  return useQuery({
    queryKey: ["agent-config", agentId],
    queryFn: () => fetchAgentConfig(agentId),
    staleTime: QUERY_STALE_TIME_MS,
    retry: 1,
  });
}

export function useSaveAgentConfig(agentId: AgentId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: AgentConfig) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/agents/${agentId}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<AgentConfig>;
      } finally {
        clearTimeout(timer);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(["agent-config", agentId], data);
    },
  });
}
