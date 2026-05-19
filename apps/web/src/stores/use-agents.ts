import { create } from "zustand";
import type {
  AgentId,
  AgentStatus,
  AgentConfig,
  AgentRun,
  ActivityEvent,
} from "@/types/agents";

// ── Placeholder data ────────────────────────────────────────────────────────
const AGENT_DEFAULTS: AgentStatus[] = [
  {
    agent_id: "live-call",
    display_name: "Live Call Agent",
    description: "Feeds the pod with relevant signal in real time during a call.",
    health: "healthy",
    model_policy: { primary: "haiku", fallback: "sonnet", model_name: "claude-3-haiku-20240307", fallback_model_name: "claude-3-5-sonnet-20241022" },
    cost_today_usd: 1.24,
    cost_cap_usd: 10,
    runs_today: 38,
    last_run_at: new Date(Date.now() - 1000 * 90).toISOString(),
    metrics: [
      { label: "Nudge act-on rate", value: 47, target: 40, unit: "%", is_rate: true },
      { label: "Bot-chat citation rate", value: 99.1, target: 98, unit: "%", is_rate: true },
      { label: "p95 bot-chat latency", value: 3.8, target: 5, unit: "s", is_rate: false },
      { label: "Pod experience rating", value: 4.3, target: 4, unit: "score", is_rate: false },
    ],
  },
  {
    agent_id: "content",
    display_name: "Content Agent",
    description: "Assembles pre-DC briefs, deck assemblies, and draft one-pagers.",
    health: "healthy",
    model_policy: { primary: "sonnet", fallback: "haiku", model_name: "claude-3-5-sonnet-20241022", fallback_model_name: "claude-3-haiku-20240307" },
    cost_today_usd: 0.87,
    cost_cap_usd: 8,
    runs_today: 12,
    last_run_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    metrics: [
      { label: "Brief open rate", value: 91, target: 85, unit: "%", is_rate: true },
      { label: "Deck slides used unchanged", value: 63, target: 60, unit: "%", is_rate: true },
      { label: "AE brief satisfaction", value: 4.4, target: 4.2, unit: "score", is_rate: false },
      { label: "Draft asset approval rate", value: 54, target: 50, unit: "%", is_rate: true },
    ],
  },
  {
    agent_id: "knowledge",
    display_name: "Knowledge Agent",
    description: "Maintains KB integrity, freshness, and asset effectiveness scoring.",
    health: "healthy",
    model_policy: { primary: "haiku", fallback: "haiku", model_name: "claude-3-haiku-20240307", fallback_model_name: "claude-3-haiku-20240307" },
    cost_today_usd: 0.31,
    cost_cap_usd: 5,
    runs_today: 7,
    last_run_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    metrics: [
      { label: "Embed SLA ≤10 min", value: 100, target: 100, unit: "%", is_rate: true },
      { label: "Retrieval precision @5", value: 88, target: 85, unit: "%", is_rate: true },
      { label: "Effectiveness correlation", value: 0.74, target: 0.7, unit: "score", is_rate: false },
      { label: "PII incidents", value: 0, target: 0, unit: "count", is_rate: false },
    ],
  },
  {
    agent_id: "coaching",
    display_name: "Coaching Agent",
    description: "Per-call scorecards, coaching recommendations, win-loss patterns.",
    health: "degraded",
    model_policy: { primary: "opus", fallback: "sonnet", model_name: "claude-3-opus-20240229", fallback_model_name: "claude-3-5-sonnet-20241022" },
    cost_today_usd: 2.15,
    cost_cap_usd: 15,
    runs_today: 5,
    last_run_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    metrics: [
      { label: "Coaching act-on rate", value: 44, target: 50, unit: "%", is_rate: true },
      { label: "Leadership insight rating", value: 3.9, target: 4, unit: "score", is_rate: false },
      { label: "Novel patterns / month", value: 2, target: 1, unit: "count", is_rate: false },
      { label: "False pattern claims", value: 0, target: 0, unit: "count", is_rate: false },
    ],
  },
  {
    agent_id: "task",
    display_name: "Task Agent",
    description: "Follow-up emails, CRM tasks, internal notifications. The muscle agent.",
    health: "healthy",
    model_policy: { primary: "haiku", fallback: "sonnet", model_name: "claude-3-haiku-20240307", fallback_model_name: "claude-3-5-sonnet-20241022" },
    cost_today_usd: 0.45,
    cost_cap_usd: 6,
    runs_today: 21,
    last_run_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    metrics: [
      { label: "Email no/minor-edit rate", value: 73, target: 70, unit: "%", is_rate: true },
      { label: "CRM task ≤60s SLA", value: 97, target: 95, unit: "%", is_rate: true },
      { label: "Unauthorized outbound sends", value: 0, target: 0, unit: "count", is_rate: false },
      { label: "AE admin time saved", value: 82, target: 80, unit: "%", is_rate: true },
    ],
  },
];

// ── Store interface ─────────────────────────────────────────────────────────
interface AgentsState {
  statuses: AgentStatus[];
  configs: Record<AgentId, AgentConfig | null>;
  runs: Record<AgentId, AgentRun[]>;
  feed: ActivityEvent[];
  selectedAgentId: AgentId | null;
  configDirty: boolean;

  setSelectedAgent: (id: AgentId | null) => void;
  setConfig: (id: AgentId, config: AgentConfig) => void;
  markConfigDirty: (dirty: boolean) => void;
  pushActivity: (event: ActivityEvent) => void;
  pushRun: (run: AgentRun) => void;
  getStatus: (id: AgentId) => AgentStatus | undefined;
}

export const useAgents = create<AgentsState>((set, get) => ({
  statuses: AGENT_DEFAULTS,
  configs: {
    "live-call": null,
    "content": null,
    "knowledge": null,
    "coaching": null,
    "task": null,
  },
  runs: {
    "live-call": [],
    "content": [],
    "knowledge": [],
    "coaching": [],
    "task": [],
  },
  feed: [],
  selectedAgentId: null,
  configDirty: false,

  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  setConfig: (id, config) =>
    set((s) => ({ configs: { ...s.configs, [id]: config }, configDirty: false })),

  markConfigDirty: (dirty) => set({ configDirty: dirty }),

  pushActivity: (event) =>
    set((s) => ({ feed: [event, ...s.feed].slice(0, 200) })),

  pushRun: (run) =>
    set((s) => ({
      runs: {
        ...s.runs,
        [run.agent_id]: [run, ...(s.runs[run.agent_id] ?? [])].slice(0, 100),
      },
    })),

  getStatus: (id) => get().statuses.find((a) => a.agent_id === id),
}));
