import { CheckCircle2, AlertTriangle, XCircle, Activity, Zap } from "lucide-react";
import { AgentStatusCard } from "@/components/agents/agent-status-card";
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed";
import type { ActivityEvent, AgentHealth } from "@/types/agents";

// ── Mock orchestrator event log ─────────────────────────────────────────────
const MOCK_FEED: ActivityEvent[] = [
  { id: "1", agent_id: "live-call", event_type: "nudge_sent",        timestamp: new Date(Date.now() - 1000 * 90).toISOString(),      description: "Objection-handler nudge sent to AE for budget concern", cost_usd: 0.0012 },
  { id: "2", agent_id: "live-call", event_type: "nudge_accepted",    timestamp: new Date(Date.now() - 1000 * 85).toISOString(),      description: "AE accepted nudge: 'Reference the TCO calculator'" },
  { id: "3", agent_id: "task",      event_type: "email_drafted",     timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),  description: "Follow-up email drafted for call CALL-1042", cost_usd: 0.0034 },
  { id: "4", agent_id: "task",      event_type: "crm_task_created",  timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),  description: "3 Salesforce tasks created for AcmeCorp opportunity" },
  { id: "5", agent_id: "content",   event_type: "brief_generated",   timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(), description: "Pre-DC brief generated for Meridian Industries (T-4h)", cost_usd: 0.0087 },
  { id: "6", agent_id: "coaching",  event_type: "scorecard_produced",timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), description: "Call scorecard produced for CALL-1041 (AE: Alex Chen)", cost_usd: 0.024 },
  { id: "7", agent_id: "coaching",  event_type: "run_failed",        timestamp: new Date(Date.now() - 1000 * 60 * 58).toISOString(), description: "Weekly coaching rollup: model timeout — retrying", cost_usd: 0 },
  { id: "8", agent_id: "knowledge", event_type: "asset_ingested",    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),description: "New asset ingested: 'Q3 Security Whitepaper v2.pdf' (42 chunks)" },
];

// ── System health derived from agent statuses ──────────────────────────────
function SystemHealthBanner({ hasOutage, hasDegraded }: { hasOutage: boolean; hasDegraded: boolean }) {
  if (hasOutage) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <XCircle className="h-5 w-5 text-destructive shrink-0" />
        <div>
          <p className="text-sm font-medium text-destructive">System Outage</p>
          <p className="text-xs text-muted-foreground">One or more agents are down. Check individual agent pages.</p>
        </div>
      </div>
    );
  }
  if (hasDegraded) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
        <div>
          <p className="text-sm font-medium">Degraded performance</p>
          <p className="text-xs text-muted-foreground">Some agents are running below optimal. Fallback models may be active.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
      <div>
        <p className="text-sm font-medium">All systems operational</p>
        <p className="text-xs text-muted-foreground">All 5 specialist agents are running normally.</p>
      </div>
    </div>
  );
}

// ── Mock agent statuses (same as store defaults) ───────────────────────────
const MOCK_STATUSES: Array<{
  agent_id: "live-call" | "content" | "knowledge" | "coaching" | "task";
  display_name: string;
  description: string;
  health: AgentHealth;
  model_policy: { primary: "haiku" | "sonnet" | "opus"; fallback: "haiku" | "sonnet" | "opus"; model_name: string; fallback_model_name: string };
  cost_today_usd: number;
  cost_cap_usd: number;
  runs_today: number;
  last_run_at: string;
  metrics: { label: string; value: number; target: number; unit: "%" | "s" | "usd" | "count" | "score"; is_rate: boolean }[];
}> = [
  { agent_id: "live-call", display_name: "Live Call Agent",  description: "Feeds the pod with relevant signal in real time during a call.", health: "healthy",  model_policy: { primary: "haiku" as const,  fallback: "sonnet" as const, model_name: "claude-3-haiku-20240307",        fallback_model_name: "claude-3-5-sonnet-20241022" }, cost_today_usd: 1.24, cost_cap_usd: 10, runs_today: 38, last_run_at: new Date(Date.now() - 1000 * 90).toISOString(),         metrics: [{ label: "Nudge act-on rate", value: 47, target: 40, unit: "%" as const, is_rate: true }, { label: "p95 bot latency", value: 3.8, target: 5, unit: "s" as const, is_rate: false }] },
  { agent_id: "content"  as const, display_name: "Content Agent",     description: "Assembles pre-DC briefs, deck assemblies, and draft one-pagers.",  health: "healthy" as const,  model_policy: { primary: "sonnet" as const, fallback: "haiku" as const,  model_name: "claude-3-5-sonnet-20241022",     fallback_model_name: "claude-3-haiku-20240307"    }, cost_today_usd: 0.87, cost_cap_usd: 8,  runs_today: 12, last_run_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),    metrics: [{ label: "Brief open rate", value: 91, target: 85, unit: "%" as const, is_rate: true }, { label: "AE satisfaction", value: 4.4, target: 4.2, unit: "score" as const, is_rate: false }] },
  { agent_id: "knowledge"as const, display_name: "Knowledge Agent",   description: "Maintains KB integrity, freshness, and asset effectiveness.",       health: "healthy" as const,  model_policy: { primary: "haiku" as const,  fallback: "haiku" as const,  model_name: "claude-3-haiku-20240307",        fallback_model_name: "claude-3-haiku-20240307"    }, cost_today_usd: 0.31, cost_cap_usd: 5,  runs_today: 7,  last_run_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),    metrics: [{ label: "Embed SLA ≤10min", value: 100, target: 100, unit: "%" as const, is_rate: true }, { label: "Retrieval precision", value: 88, target: 85, unit: "%" as const, is_rate: true }] },
  { agent_id: "coaching" as const, display_name: "Coaching Agent",    description: "Scorecards, coaching recommendations, win-loss patterns.",           health: "degraded" as const, model_policy: { primary: "opus" as const,   fallback: "sonnet" as const, model_name: "claude-3-opus-20240229",         fallback_model_name: "claude-3-5-sonnet-20241022" }, cost_today_usd: 2.15, cost_cap_usd: 15, runs_today: 5,  last_run_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),     metrics: [{ label: "Coaching act-on rate", value: 44, target: 50, unit: "%" as const, is_rate: true }, { label: "Leadership rating", value: 3.9, target: 4, unit: "score" as const, is_rate: false }] },
  { agent_id: "task"     as const, display_name: "Task Agent",        description: "Follow-up emails, CRM tasks, internal notifications.",                health: "healthy" as const,  model_policy: { primary: "haiku" as const,  fallback: "sonnet" as const, model_name: "claude-3-haiku-20240307",        fallback_model_name: "claude-3-5-sonnet-20241022" }, cost_today_usd: 0.45, cost_cap_usd: 6,  runs_today: 21, last_run_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),     metrics: [{ label: "Email approval rate", value: 73, target: 70, unit: "%" as const, is_rate: true }, { label: "CRM task SLA", value: 97, target: 95, unit: "%" as const, is_rate: true }] },
];

export default function AgentsPage() {
  const hasOutage = MOCK_STATUSES.some((a) => a.health === "outage");
  const hasDegraded = MOCK_STATUSES.some((a) => a.health === "degraded");

  const totalCost = MOCK_STATUSES.reduce((s, a) => s + a.cost_today_usd, 0);
  const totalRuns = MOCK_STATUSES.reduce((s, a) => s + a.runs_today, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold">Agent Control Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor, configure, and control the 5 specialist AI agents powering DC Copilot.
        </p>
      </div>

      {/* System health */}
      <SystemHealthBanner hasOutage={hasOutage} hasDegraded={hasDegraded} />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Activity className="h-4 w-4" />
            <span className="text-xs">Total runs today</span>
          </div>
          <p className="text-2xl font-bold">{totalRuns}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs">Total cost today</span>
          </div>
          <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Agents operational</span>
          </div>
          <p className="text-2xl font-bold">
            {MOCK_STATUSES.filter((a) => a.health === "healthy").length}
            <span className="text-sm font-normal text-muted-foreground">/{MOCK_STATUSES.length}</span>
          </p>
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {MOCK_STATUSES.map((s) => (
          <AgentStatusCard key={s.agent_id} status={s} />
        ))}
      </div>

      {/* Orchestrator event feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Orchestrator Event Log</h2>
          <span className="text-xs text-muted-foreground">Last 50 events · real-time</span>
        </div>
        <AgentActivityFeed events={MOCK_FEED} maxHeight="360px" />
      </div>
    </div>
  );
}
