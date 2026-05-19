import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed";
import { AgentRunTable } from "@/components/agents/agent-run-table";
import { ModelPolicyBadge } from "@/components/agents/model-policy-badge";
import { CostGaugeBar } from "@/components/agents/cost-gauge-bar";
import type { AgentId, AgentRun, ActivityEvent, AgentHealth } from "@/types/agents";
import { cn } from "@/lib/cn";

// ── Static params ─────────────────────────────────────────────────────────
const AGENT_IDS: AgentId[] = ["live-call", "content", "knowledge", "coaching", "task"];

export function generateStaticParams() {
  return AGENT_IDS.map((id) => ({ agentId: id }));
}

// ── Mock data helpers ─────────────────────────────────────────────────────
const AGENT_META: Record<AgentId, { display_name: string; description: string; purpose: string }> = {
  "live-call": {
    display_name: "Live Call Agent",
    description: "Real-time signal feed for the pod during active calls.",
    purpose: "Operate the live-call experience: feed the pod with relevant signal in real time while the call is happening, without breaking the flow of conversation.",
  },
  "content": {
    display_name: "Content Agent",
    description: "Pre-DC briefs, deck assemblies, and draft content artifacts.",
    purpose: "Find, assemble, and (when needed) draft content artifacts — pre-call briefs, deck assemblies, slide drafts, one-pagers — grounded in the KB.",
  },
  "knowledge": {
    display_name: "Knowledge Agent",
    description: "KB integrity, freshness, and asset effectiveness.",
    purpose: "Maintain the integrity, freshness, and effectiveness of the Knowledge Base. The KB is the substrate; this agent is its keeper.",
  },
  "coaching": {
    display_name: "Coaching Agent",
    description: "Scorecards, coaching recommendations, win-loss patterns.",
    purpose: "Produce coaching insights for Sales Leadership: per-call scorecards, per-person coaching recommendations, win-loss pattern analysis, content-effectiveness rollups.",
  },
  "task": {
    display_name: "Task Agent",
    description: "Follow-up emails, CRM tasks, internal notifications.",
    purpose: "Turn call outcomes into concrete next-step artifacts: follow-up emails, CRM tasks, internal notifications, content-gap requests. The 'muscle' agent — it executes.",
  },
};

function generateMockRuns(agentId: AgentId): AgentRun[] {
  const ops: Record<AgentId, string[]> = {
    "live-call": ["proactive_nudge", "bot_chat_response", "signal_annotation"],
    "content":   ["pre_dc_brief", "deck_assembly", "draft_asset"],
    "knowledge": ["ingest_asset", "re_embed", "effectiveness_score"],
    "coaching":  ["call_scorecard", "coaching_recommendation", "win_loss_insight"],
    "task":      ["draft_email", "create_crm_task", "notify_internal"],
  };

  return Array.from({ length: 20 }, (_, i) => ({
    id: `run-${agentId}-${i}`,
    agent_id: agentId,
    trigger: ["live_transcript", "scheduled", "manual", "call_end", "bot_chat"][i % 5] as AgentRun["trigger"],
    triggered_at: new Date(Date.now() - i * 1000 * 60 * 15).toISOString(),
    completed_at: new Date(Date.now() - i * 1000 * 60 * 15 + 2500).toISOString(),
    duration_ms: 800 + Math.floor(Math.random() * 4200),
    outcome: i === 6 ? "failed" : i === 11 ? "partial" : "success" as AgentRun["outcome"],
    cost_usd: parseFloat((0.001 + Math.random() * 0.03).toFixed(4)),
    tokens_used: 400 + Math.floor(Math.random() * 3000),
    model_used: agentId === "coaching" ? "claude-3-opus-20240229" : "claude-3-haiku-20240307",
    operation: ops[agentId][i % ops[agentId].length],
    trace_id: `trace-${Math.random().toString(36).slice(2, 10)}`,
    error_message: i === 6 ? "LLM provider timeout after 3 retries" : undefined,
  }));
}

function generateMockFeed(agentId: AgentId): ActivityEvent[] {
  const events: ActivityEvent["event_type"][] = {
    "live-call": ["nudge_sent", "nudge_accepted", "nudge_dismissed", "bot_chat_answered"],
    "content":   ["brief_generated"],
    "knowledge": ["asset_ingested"],
    "coaching":  ["scorecard_produced", "run_failed"],
    "task":      ["email_drafted", "crm_task_created"],
  }[agentId] as ActivityEvent["event_type"][];

  return Array.from({ length: 15 }, (_, i) => ({
    id: `ev-${i}`,
    agent_id: agentId,
    event_type: events[i % events.length],
    timestamp: new Date(Date.now() - i * 1000 * 60 * 8).toISOString(),
    description: `${events[i % events.length].replace(/_/g, " ")} — event ${i + 1}`,
    cost_usd: parseFloat((Math.random() * 0.01).toFixed(4)),
  }));
}

// ── Metric card ───────────────────────────────────────────────────────────
function MetricCard({ label, value, target, unit, is_rate }: { label: string; value: number; target: number; unit: string; is_rate: boolean }) {
  const passing = is_rate ? value >= target : (target === 0 ? value === 0 : value <= target || value >= target);
  const pct = Math.min((value / (target || 1)) * 100, 120);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <span className={cn("text-2xl font-bold", passing ? "text-success" : "text-warning")}>
          {value}{unit === "%" ? "%" : unit === "s" ? "s" : unit === "score" ? "" : ""}
        </span>
        <span className="text-xs text-muted-foreground mb-1">
          target {target}{unit === "%" ? "%" : unit === "s" ? "s" : ""}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", passing ? "bg-success" : "bg-warning")}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default async function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId: rawAgentId } = await params;
  const agentId = rawAgentId as AgentId;
  if (!AGENT_IDS.includes(agentId)) notFound();

  const meta = AGENT_META[agentId];
  const runs = generateMockRuns(agentId);
  const feed = generateMockFeed(agentId);

  const costToday = runs.reduce((s, r) => s + r.cost_usd, 0);
  const successRate = (runs.filter((r) => r.outcome === "success").length / runs.length) * 100;

  const MOCK_BY_AGENT: Record<AgentId, { health: AgentHealth; cost_cap_usd: number; model_policy: { primary: "haiku" | "sonnet" | "opus"; fallback: "haiku" | "sonnet" | "opus"; model_name: string; fallback_model_name: string } }> = {
    "live-call": { health: "healthy", cost_cap_usd: 10, model_policy: { primary: "haiku", fallback: "sonnet", model_name: "claude-3-haiku-20240307", fallback_model_name: "claude-3-5-sonnet-20241022" } },
    content: { health: "healthy", cost_cap_usd: 8, model_policy: { primary: "sonnet", fallback: "haiku", model_name: "claude-3-5-sonnet-20241022", fallback_model_name: "claude-3-haiku-20240307" } },
    knowledge: { health: "healthy", cost_cap_usd: 5, model_policy: { primary: "haiku", fallback: "haiku", model_name: "claude-3-haiku-20240307", fallback_model_name: "claude-3-haiku-20240307" } },
    coaching: { health: "degraded", cost_cap_usd: 15, model_policy: { primary: "opus", fallback: "sonnet", model_name: "claude-3-opus-20240229", fallback_model_name: "claude-3-5-sonnet-20241022" } },
    task: { health: "healthy", cost_cap_usd: 6, model_policy: { primary: "haiku", fallback: "sonnet", model_name: "claude-3-haiku-20240307", fallback_model_name: "claude-3-5-sonnet-20241022" } },
  };
  const MOCK_STATUS = MOCK_BY_AGENT[agentId];

  const METRICS = [
    { label: "Success rate (today)", value: successRate, target: 95, unit: "%", is_rate: true },
    { label: "Total runs today", value: runs.length, target: 0, unit: "count", is_rate: false },
    { label: "Cost today", value: parseFloat(costToday.toFixed(2)), target: MOCK_STATUS.cost_cap_usd, unit: "usd", is_rate: false },
    { label: "Avg duration", value: Math.round(runs.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / runs.length / 1000 * 10) / 10, target: 5, unit: "s", is_rate: false },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/agents" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Agents
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{meta.display_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{meta.display_name}</h1>
            <Badge
              variant="outline"
              className={cn("text-xs font-medium", {
                "text-success border-success/40 bg-success/5": MOCK_STATUS.health === "healthy",
                "text-warning border-warning/40 bg-warning/5": MOCK_STATUS.health === "degraded",
                "text-destructive border-destructive/40 bg-destructive/5": MOCK_STATUS.health === "outage",
              })}
            >
              {MOCK_STATUS.health}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{meta.purpose}</p>
        </div>
        <Link href={`/agents/${agentId}/config`}>
          <Button variant="outline" className="gap-2 shrink-0">
            <Settings className="h-4 w-4" />
            Configure
          </Button>
        </Link>
      </div>

      {/* Model + Cost quick info */}
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Model</p>
          <ModelPolicyBadge policy={MOCK_STATUS.model_policy} showFallback />
        </div>
        <div className="min-w-[200px]">
          <p className="text-xs text-muted-foreground mb-1">Daily spend vs cap</p>
          <CostGaugeBar spentUsd={costToday} capUsd={MOCK_STATUS.cost_cap_usd} />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {METRICS.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Tabs: Activity / Run History */}
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity feed</TabsTrigger>
          <TabsTrigger value="runs">Run history</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          <AgentActivityFeed events={feed} maxHeight="480px" />
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <AgentRunTable runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
