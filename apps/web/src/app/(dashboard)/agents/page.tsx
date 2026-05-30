"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Activity, Zap } from "lucide-react";
import { AgentStatusCard } from "@/components/agents/agent-status-card";
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { useAgentAudit, useAgentRuns } from "@/lib/data/hooks";
import { buildAgentStatuses } from "@/lib/agents/catalog";

function SystemHealthBanner({ hasOutage, hasDegraded }: { hasOutage: boolean; hasDegraded: boolean }) {
  if (hasOutage) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <XCircle className="h-5 w-5 text-destructive shrink-0" />
        <div>
          <p className="text-sm font-medium text-destructive">System Outage</p>
          <p className="text-xs text-muted-foreground">One or more agents reported failures.</p>
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
          <p className="text-xs text-muted-foreground">Some agents have not run recently.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
      <div>
        <p className="text-sm font-medium">Agents ready</p>
        <p className="text-xs text-muted-foreground">Metrics reflect recorded agent runs from the API.</p>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { data: runs = [] } = useAgentRuns();
  const { data: feed = [] } = useAgentAudit();

  const statuses = useMemo(() => buildAgentStatuses(runs), [runs]);

  const hasOutage = statuses.some((a) => a.health === "outage");
  const hasDegraded = statuses.some((a) => a.health === "degraded" || a.health === "idle");
  const totalCost = statuses.reduce((s, a) => s + a.cost_today_usd, 0);
  const totalRuns = statuses.reduce((s, a) => s + a.runs_today, 0);
  const healthyCount = statuses.filter((a) => a.health === "healthy").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent Control Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Five orchestrator-backed agents — spend and runs come from the API; configure caps and models per agent.
        </p>
      </div>

      <SystemHealthBanner hasOutage={hasOutage} hasDegraded={hasDegraded} />

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-insight-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Activity className="h-4 w-4" />
            <span className="text-xs">Total runs today</span>
          </div>
          <p className="text-2xl font-bold">{totalRuns}</p>
        </div>
        <div className="glass-insight-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs">Total cost today</span>
          </div>
          <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
        </div>
        <div className="glass-insight-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Agents with runs today</span>
          </div>
          <p className="text-2xl font-bold">
            {healthyCount}
            <span className="text-sm font-normal text-muted-foreground">/{statuses.length}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statuses.map((s) => (
          <AgentStatusCard key={s.agent_id} status={s} />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Orchestrator Event Log</h2>
          <span className="text-xs text-muted-foreground">From audit API</span>
        </div>
        {feed.length > 0 ? (
          <AgentActivityFeed events={feed} maxHeight="360px" />
        ) : (
          <EmptyState
            icon={Activity}
            title="No agent events yet"
            description="Run an agent operation (e.g. generate a brief or ingest KB) to populate the log."
          />
        )}
      </div>
    </div>
  );
}
