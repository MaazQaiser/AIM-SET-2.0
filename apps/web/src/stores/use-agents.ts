import { create } from "zustand";
import type { AgentId, AgentConfig } from "@/types/agents";
import { PROJECT_AGENT_IDS } from "@/lib/agents/catalog";

interface AgentsState {
  configs: Record<AgentId, AgentConfig | null>;
  selectedAgentId: AgentId | null;
  configDirty: boolean;

  setSelectedAgent: (id: AgentId | null) => void;
  setConfig: (id: AgentId, config: AgentConfig) => void;
  markConfigDirty: (dirty: boolean) => void;
}

const emptyConfigs = Object.fromEntries(
  PROJECT_AGENT_IDS.map((id) => [id, null])
) as Record<AgentId, AgentConfig | null>;

export const useAgents = create<AgentsState>((set) => ({
  configs: emptyConfigs,
  selectedAgentId: null,
  configDirty: false,

  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  setConfig: (id, config) =>
    set((s) => ({ configs: { ...s.configs, [id]: config }, configDirty: false })),

  markConfigDirty: (dirty) => set({ configDirty: dirty }),
}));
