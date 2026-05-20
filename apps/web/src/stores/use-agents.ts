import { create } from "zustand";
import type { AgentId, AgentConfig, AgentRun, ActivityEvent } from "@/types/agents";

interface AgentsState {
  configs: Record<AgentId, AgentConfig | null>;
  selectedAgentId: AgentId | null;
  configDirty: boolean;

  setSelectedAgent: (id: AgentId | null) => void;
  setConfig: (id: AgentId, config: AgentConfig) => void;
  markConfigDirty: (dirty: boolean) => void;
}

export const useAgents = create<AgentsState>((set) => ({
  configs: {
    "live-call": null,
    content: null,
    content_generation: null,
    knowledge: null,
    coaching: null,
    task: null,
  },
  selectedAgentId: null,
  configDirty: false,

  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  setConfig: (id, config) =>
    set((s) => ({ configs: { ...s.configs, [id]: config }, configDirty: false })),

  markConfigDirty: (dirty) => set({ configDirty: dirty }),
}));
