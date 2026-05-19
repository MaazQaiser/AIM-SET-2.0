import type { AgentId, AgentStatus } from "@/types/agents";

export const AGENT_META: Record<
  AgentId,
  { display_name: string; description: string; purpose: string }
> = {
  "live-call": {
    display_name: "Live Call Agent",
    description: "Real-time signal feed for the pod during active calls.",
    purpose:
      "Operate the live-call experience: feed the pod with relevant signal in real time while the call is happening.",
  },
  content: {
    display_name: "Content Agent",
    description: "Pre-DC briefs, deck assemblies, and draft content artifacts.",
    purpose:
      "Find, assemble, and draft content artifacts grounded in the KB — pre-call briefs, decks, one-pagers.",
  },
  knowledge: {
    display_name: "Knowledge Agent",
    description: "KB integrity, freshness, and asset effectiveness.",
    purpose: "Maintain the integrity, freshness, and effectiveness of the Knowledge Base.",
  },
  coaching: {
    display_name: "Coaching Agent",
    description: "Scorecards, coaching recommendations, win-loss patterns.",
    purpose: "Produce coaching insights: scorecards, recommendations, and pattern analysis.",
  },
  task: {
    display_name: "Task Agent",
    description: "Follow-up emails, CRM tasks, internal notifications.",
    purpose: "Turn call outcomes into follow-up emails, CRM tasks, and internal notifications.",
  },
};

/** Static agent catalog (metadata only — metrics come from API runs). */
export const AGENT_CATALOG: Omit<AgentStatus, "cost_today_usd" | "runs_today" | "last_run_at" | "metrics" | "health">[] = [
  {
    agent_id: "live-call",
    display_name: "Live Call Agent",
    description: "Feeds the pod with relevant signal in real time during a call.",
    model_policy: {
      primary: "haiku",
      fallback: "sonnet",
      model_name: "claude-3-haiku-20240307",
      fallback_model_name: "claude-3-5-sonnet-20241022",
    },
    cost_cap_usd: 10,
  },
  {
    agent_id: "content",
    display_name: "Content Agent",
    description: "Assembles pre-DC briefs, deck assemblies, and draft one-pagers.",
    model_policy: {
      primary: "sonnet",
      fallback: "haiku",
      model_name: "claude-3-5-sonnet-20241022",
      fallback_model_name: "claude-3-haiku-20240307",
    },
    cost_cap_usd: 8,
  },
  {
    agent_id: "knowledge",
    display_name: "Knowledge Agent",
    description: "Maintains KB integrity, freshness, and asset effectiveness scoring.",
    model_policy: {
      primary: "haiku",
      fallback: "haiku",
      model_name: "claude-3-haiku-20240307",
      fallback_model_name: "claude-3-haiku-20240307",
    },
    cost_cap_usd: 5,
  },
  {
    agent_id: "coaching",
    display_name: "Coaching Agent",
    description: "Per-call scorecards, coaching recommendations, win-loss patterns.",
    model_policy: {
      primary: "opus",
      fallback: "sonnet",
      model_name: "claude-3-opus-20240229",
      fallback_model_name: "claude-3-5-sonnet-20241022",
    },
    cost_cap_usd: 15,
  },
  {
    agent_id: "task",
    display_name: "Task Agent",
    description: "Follow-up emails, CRM tasks, and internal notifications.",
    model_policy: {
      primary: "haiku",
      fallback: "sonnet",
      model_name: "claude-3-haiku-20240307",
      fallback_model_name: "claude-3-5-sonnet-20241022",
    },
    cost_cap_usd: 6,
  },
];

export function buildAgentStatuses(
  runs: { agent_id?: string; cost_usd?: number; created_at?: string }[]
): AgentStatus[] {
  const today = new Date().toDateString();
  return AGENT_CATALOG.map((base) => {
    const agentRuns = runs.filter((r) => r.agent_id === base.agent_id);
    const todayRuns = agentRuns.filter((r) => r.created_at && new Date(r.created_at).toDateString() === today);
    const costToday = todayRuns.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
    const lastRun = agentRuns
      .map((r) => r.created_at)
      .filter(Boolean)
      .sort()
      .reverse()[0];

    return {
      ...base,
      health: agentRuns.length > 0 ? "healthy" : "idle",
      cost_today_usd: costToday,
      runs_today: todayRuns.length,
      last_run_at: lastRun ?? new Date(0).toISOString(),
      metrics: [],
    } satisfies AgentStatus;
  });
}
