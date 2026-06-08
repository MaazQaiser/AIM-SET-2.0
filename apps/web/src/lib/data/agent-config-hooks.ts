"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_STALE_TIME_MS } from "@/lib/data/query-cache";
import type { AgentConfig, AgentId } from "@/types/agents";

async function fetchAgentConfig(agentId: AgentId): Promise<AgentConfig> {
  const res = await fetch(`/api/agents/${agentId}/config`, { cache: "no-store" });
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
      const res = await fetch(`/api/agents/${agentId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AgentConfig>;
    },
    onSuccess: (data) => {
      qc.setQueryData(["agent-config", agentId], data);
    },
  });
}
