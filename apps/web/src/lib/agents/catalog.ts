import type { AgentId, AgentStatus, ModelPolicy } from "@/types/agents";

/** Agents implemented in services/api/app/agents/ and the orchestrator. */
export const PROJECT_AGENT_IDS: AgentId[] = [
  "live-call",
  "discovery-checklist",
  "content",
  "workflow",
  "content_generation",
  "knowledge",
  "coaching",
  "task",
];

export const AGENT_META: Record<
  AgentId,
  { display_name: string; description: string; purpose: string; operations: string[] }
> = {
  "live-call": {
    display_name: "Live Call Agent",
    description:
      "Real-time signal feed for the pod during active calls, including Intent Detection (sentiment, keywords, pains, focus areas).",
    purpose:
      "Operate the live-call experience: feed the pod with relevant signal in real time while the call is happening. Intent Detection runs as an in-agent module on every transcript segment.",
    operations: [
      "proactive_nudge",
      "signal_annotation",
      "intent_snapshot",
      "sentiment_update",
      "focus_suggestion",
    ],
  },
  "discovery-checklist": {
    display_name: "Discovery Checklist Tracker",
    description: "Real-time BANT and discovery checklist coverage with timed nudges.",
    purpose:
      "Track qualification coverage during discovery calls and nudge the AE on missed BANT and closure items.",
    operations: ["checklist_updated", "discovery_nudge", "session_finalized"],
  },
  content: {
    display_name: "Content Agent",
    description: "Pre-DC briefs grounded in KB and DC notes.",
    purpose:
      "Find, assemble, and draft content artifacts grounded in the KB — pre-call briefs, decks, one-pagers.",
    operations: ["pre_dc_brief"],
  },
  workflow: {
    display_name: "PRE-DC Workflow",
    description:
      "Pre-DC screen output: AI summary, artifact planning, and KB fulfillment on every lead ingest.",
    purpose:
      "On each Pre-DC CSV row, run PRE-DC Workflow to generate the executive summary, plan DC artifacts, and fulfill them from the KB — shown on the Pre-call brief.",
    operations: ["workflow_pipeline"],
  },
  content_generation: {
    display_name: "Content Generation Agent",
    description: "Chat-driven studio for decks, one-pagers, and images (HTML preview + export).",
    purpose:
      "Turn AE intent into grounded HTML/CSS artifacts via templates and KB citations, with PDF/PNG/PPTX export.",
    operations: ["studio_turn", "template_ingest", "export_pdf", "export_png", "export_pptx"],
  },
  knowledge: {
    display_name: "Knowledge Agent",
    description: "KB ingest metadata and asset lifecycle hooks.",
    purpose: "Maintain the integrity, freshness, and effectiveness of the Knowledge Base.",
    operations: ["asset_ingested"],
  },
  coaching: {
    display_name: "Coaching Agent",
    description: "Post-call scorecards and coaching signals.",
    purpose: "Produce coaching insights: scorecards, recommendations, and pattern analysis.",
    operations: ["scorecard"],
  },
  task: {
    display_name: "Task Agent",
    description: "Follow-up emails, CRM tasks, internal notifications.",
    purpose: "Turn call outcomes into follow-up emails, CRM tasks, and internal notifications.",
    operations: ["post_call_artifacts"],
  },
};

/** Default cost caps (match services/api/app/domain/agent_config_defaults.py). */
export const DEFAULT_COST_CAPS: Record<
  AgentId,
  { per_run_usd: number; project_usd?: number; abort_strategy: string }
> = {
  "live-call": { per_run_usd: 0.02, abort_strategy: "degrade" },
  "discovery-checklist": { per_run_usd: 0.02, abort_strategy: "degrade" },
  content: { per_run_usd: 0.05, abort_strategy: "degrade" },
  workflow: { per_run_usd: 0.05, abort_strategy: "degrade" },
  content_generation: { per_run_usd: 0.05, project_usd: 1.5, abort_strategy: "hard_stop" },
  knowledge: { per_run_usd: 0.02, abort_strategy: "degrade" },
  coaching: { per_run_usd: 0.15, abort_strategy: "degrade" },
  task: { per_run_usd: 0.02, abort_strategy: "degrade" },
};

const DEFAULT_MODEL_POLICY: Record<AgentId, ModelPolicy> = {
  "live-call": {
    primary: "haiku",
    fallback: "sonnet",
    model_name: "claude-3-haiku-20240307",
    fallback_model_name: "claude-sonnet-4-6",
  },
  "discovery-checklist": {
    primary: "haiku",
    fallback: "sonnet",
    model_name: "claude-3-haiku-20240307",
    fallback_model_name: "claude-sonnet-4-6",
  },
  content: {
    primary: "opus",
    fallback: "sonnet",
    model_name: "claude-opus-4-7",
    fallback_model_name: "claude-sonnet-4-6",
  },
  workflow: {
    primary: "opus",
    fallback: "sonnet",
    model_name: "claude-opus-4-7",
    fallback_model_name: "claude-sonnet-4-6",
  },
  content_generation: {
    primary: "opus",
    fallback: "sonnet",
    model_name: "claude-opus-4-7",
    fallback_model_name: "claude-sonnet-4-6",
  },
  knowledge: {
    primary: "haiku",
    fallback: "sonnet",
    model_name: "claude-3-haiku-20240307",
    fallback_model_name: "claude-sonnet-4-6",
  },
  coaching: {
    primary: "opus",
    fallback: "sonnet",
    model_name: "claude-3-opus-20240229",
    fallback_model_name: "claude-sonnet-4-6",
  },
  task: {
    primary: "haiku",
    fallback: "sonnet",
    model_name: "claude-3-haiku-20240307",
    fallback_model_name: "claude-sonnet-4-6",
  },
};

function displayCapUsd(agentId: AgentId): number {
  const caps = DEFAULT_COST_CAPS[agentId];
  return caps.project_usd ?? caps.per_run_usd;
}

export function buildAgentStatuses(
  runs: { agent_id?: string; cost_usd?: number; created_at?: string }[]
): AgentStatus[] {
  const today = new Date().toDateString();
  return PROJECT_AGENT_IDS.map((agentId) => {
    const meta = AGENT_META[agentId];
    const caps = DEFAULT_COST_CAPS[agentId];
    const agentRuns = runs.filter((r) => r.agent_id === agentId);
    const todayRuns = agentRuns.filter(
      (r) => r.created_at && new Date(r.created_at).toDateString() === today
    );
    const costToday = todayRuns.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
    const lastRun = agentRuns
      .map((r) => r.created_at)
      .filter(Boolean)
      .sort()
      .reverse()[0];

    const hasFailed = agentRuns.some((r) => (r as { status?: string }).status === "failed");
    let health: AgentStatus["health"] = "idle";
    if (agentRuns.length > 0) {
      health = hasFailed ? "degraded" : "healthy";
    }

    return {
      agent_id: agentId,
      display_name: meta.display_name,
      description: meta.description,
      health,
      model_policy: DEFAULT_MODEL_POLICY[agentId],
      cost_today_usd: costToday,
      cost_cap_usd: displayCapUsd(agentId),
      per_run_cap_usd: caps.per_run_usd,
      project_cap_usd: caps.project_usd,
      runs_today: todayRuns.length,
      last_run_at: lastRun,
      metrics: [],
    } satisfies AgentStatus;
  });
}
