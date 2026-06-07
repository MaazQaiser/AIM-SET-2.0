"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, Settings, Activity } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed";
import { AgentRunTable } from "@/components/agents/agent-run-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ModelPolicyBadge } from "@/components/agents/model-policy-badge";
import { CostGaugeBar } from "@/components/agents/cost-gauge-bar";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import type { AgentId } from "@/types/agents";
import { cn } from "@/lib/cn";
import { AGENT_META, buildAgentStatuses } from "@/lib/agents/catalog";
import { useAgentAudit, useAgentRuns } from "@/lib/data/hooks";
import { useAgentConfig } from "@/lib/data/agent-config-hooks";

function MetricCard({
  label,
  value,
  target,
  unit,
  is_rate,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  is_rate: boolean;
}) {
  const passing = is_rate ? value >= target : target === 0 ? value === 0 : value <= target;
  const pct = Math.min((value / (target || 1)) * 100, 120);

  return (
    <Card>
      <CardContent className="space-y-2 p-4 pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <span className={cn("text-2xl font-bold", passing ? "text-success" : "text-warning")}>
          {value}
          {unit === "%" ? "%" : unit === "s" ? "s" : ""}
        </span>
        {target > 0 && (
          <span className="text-xs text-muted-foreground mb-1">
            target {target}
            {unit === "%" ? "%" : unit === "s" ? "s" : ""}
          </span>
        )}
      </div>
      {target > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", passing ? "bg-success" : "bg-warning")}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
      </CardContent>
    </Card>
  );
}

export function AgentDetailClient({ agentId }: { agentId: AgentId }) {
  const { data: allRuns = [] } = useAgentRuns();
  const { data: allFeed = [] } = useAgentAudit();
  const { data: agentConfig } = useAgentConfig(agentId);

  const meta = AGENT_META[agentId];
  const status = buildAgentStatuses(allRuns).find((s) => s.agent_id === agentId);
  const runs = useMemo(() => allRuns.filter((r) => r.agent_id === agentId), [allRuns, agentId]);
  const feed = useMemo(() => allFeed.filter((e) => e.agent_id === agentId), [allFeed, agentId]);

  const costToday = runs.reduce((s, r) => s + r.cost_usd, 0);
  const tokensToday = runs.reduce((s, r) => s + (r.tokens_used ?? 0), 0);
  const successRate =
    runs.length > 0 ? (runs.filter((r) => r.outcome === "success").length / runs.length) * 100 : 0;

  const perRunCap =
    agentConfig?.cost_cap.per_run_ceiling_usd ?? status?.per_run_cap_usd ?? status?.cost_cap_usd ?? 0.05;
  const projectCap = agentConfig?.cost_cap.project_ceiling_usd ?? status?.project_cap_usd;
  const gaugeCap = projectCap ?? perRunCap;
  const health = status?.health ?? "idle";
  const modelPolicy = agentConfig?.model_policy ?? status?.model_policy;

  const metrics = [
    { label: "Success rate", value: Math.round(successRate), target: 0, unit: "%", is_rate: true },
    { label: "Runs recorded", value: runs.length, target: 0, unit: "count", is_rate: false },
    { label: "Cost today", value: Number.parseFloat(costToday.toFixed(4)), target: 0, unit: "usd", is_rate: false },
    { label: "Tokens today", value: tokensToday, target: 0, unit: "count", is_rate: false },
  ];

  return (
    <PageShell size="wide">
      <PageHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <Link
            href="/agents"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Agents
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{meta.display_name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{meta.display_name}</h1>
              <Badge variant="outline" className="text-xs font-medium capitalize">
                {health}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">{meta.purpose}</p>
            <p className="text-xs text-muted-foreground font-mono">
              Operations: {meta.operations.join(", ")}
            </p>
          </div>
          <Link href={`/agents/${agentId}/config`}>
            <Button variant="outline" className="gap-2 shrink-0">
              <Settings className="h-4 w-4" />
              Configure
            </Button>
          </Link>
        </div>
      </PageHeader>

      {modelPolicy && (
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Model</p>
            <ModelPolicyBadge policy={modelPolicy} showFallback />
          </div>
          <div className="min-w-[200px]">
            <p className="text-xs text-muted-foreground mb-1">Spend vs {projectCap ? "project" : "per-run"} cap</p>
            <CostGaugeBar
              spentUsd={costToday}
              capUsd={gaugeCap}
              capLabel={projectCap ? "project cap" : "per-run cap"}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Per-run ${perRunCap.toFixed(2)}
              {projectCap != null ? ` · Project $${projectCap.toFixed(2)}` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity feed</TabsTrigger>
          <TabsTrigger value="runs">Run history</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          {feed.length > 0 ? (
            <AgentActivityFeed events={feed} maxHeight="480px" />
          ) : (
            <EmptyState icon={Activity} title="No activity yet" description="Agent audit events will appear here." />
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          {runs.length > 0 ? (
            <AgentRunTable runs={runs} />
          ) : (
            <EmptyState icon={Activity} title="No runs yet" description="Trigger this agent to see run history." />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
