"use client";

import Link from "next/link";
import { Activity, Settings, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardFooter } from "@dc-copilot/ui/components/card";
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
    <Card className="flex flex-col">
      <CardContent className="space-y-4 p-5 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <h2 className="truncate text-sm font-semibold text-foreground">{status.display_name}</h2>
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{status.description}</p>
          </div>
          <div className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", health.className)}>
            <HealthIcon className="h-3.5 w-3.5" />
            <span>{health.label}</span>
          </div>
        </header>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Model</p>
            <ModelPolicyBadge policy={status.model_policy} />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Spend today</p>
            <CostGaugeBar
              spentUsd={status.cost_today_usd}
              capUsd={status.cost_cap_usd}
              capLabel={status.project_cap_usd ? "project cap" : "per-run cap"}
            />
            {status.per_run_cap_usd != null && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Per-run ceiling ${status.per_run_cap_usd.toFixed(2)}
                {status.project_cap_usd != null
                  ? ` · Project ceiling $${status.project_cap_usd.toFixed(2)}`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{status.runs_today} runs today</span>
            {status.last_run_at && <span>Last: {formatRelative(status.last_run_at)}</span>}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 border-t border-border px-5 pb-5 pt-0">
        <Link
          href={`/agents/${status.agent_id}`}
          className="flex flex-1 items-center justify-center gap-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>View detail</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/agents/${status.agent_id}/config`}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Config</span>
        </Link>
      </CardFooter>
    </Card>
  );
}
