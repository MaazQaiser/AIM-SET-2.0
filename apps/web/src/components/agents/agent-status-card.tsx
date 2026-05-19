"use client";

import Link from "next/link";
import { Activity, Settings, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModelPolicyBadge } from "./model-policy-badge";
import { CostGaugeBar } from "./cost-gauge-bar";
import type { AgentStatus } from "@/types/agents";
import { cn } from "@/lib/cn";

interface AgentStatusCardProps {
  status: AgentStatus;
}

const HEALTH_CONFIG = {
  healthy: { icon: CheckCircle2, label: "Healthy", className: "text-success" },
  degraded: { icon: AlertTriangle, label: "Degraded", className: "text-warning" },
  outage: { icon: XCircle, label: "Outage", className: "text-destructive" },
  idle: { icon: Clock, label: "Idle", className: "text-muted-foreground" },
};

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3600_000)}h ago`;
}

export function AgentStatusCard({ status }: AgentStatusCardProps) {
  const health = HEALTH_CONFIG[status.health];
  const HealthIcon = health.icon;

  return (
    <Card className="flex flex-col hover:shadow-soft-sm transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{status.display_name}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{status.description}</p>
          </div>
          <div className={cn("flex items-center gap-1 text-xs font-medium", health.className)}>
            <HealthIcon className="h-3.5 w-3.5" />
            <span>{health.label}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 pb-3">
        {/* Model */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Model</p>
          <ModelPolicyBadge policy={status.model_policy} />
        </div>

        {/* Cost */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Daily spend</p>
          <CostGaugeBar spentUsd={status.cost_today_usd} capUsd={status.cost_cap_usd} />
        </div>

        {/* Key metrics — top 2 */}
        <div className="grid grid-cols-2 gap-2">
          {status.metrics.slice(0, 2).map((m) => {
            const passing = m.is_rate ? m.value >= m.target : m.value <= m.target || m.target === 0 ? m.value === m.target : m.value >= m.target;
            return (
              <div key={m.label} className="rounded-md bg-muted/50 p-2">
                <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">{m.label}</p>
                <p className={cn("text-sm font-semibold", passing ? "text-success" : "text-warning")}>
                  {m.value}{m.unit === "%" ? "%" : m.unit === "s" ? "s" : m.unit === "score" ? "/5" : ""}
                </p>
              </div>
            );
          })}
        </div>

        {/* Runs + last run */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{status.runs_today} runs today</span>
          {status.last_run_at && <span>Last: {formatRelative(status.last_run_at)}</span>}
        </div>
      </CardContent>

      <CardFooter className="pt-0 border-t flex gap-2">
        <Link
          href={`/agents/${status.agent_id}`}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
        >
          <span>View detail</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/agents/${status.agent_id}/config`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-2 px-2 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Config</span>
        </Link>
      </CardFooter>
    </Card>
  );
}
