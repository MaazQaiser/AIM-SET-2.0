"use client";

import { estimateTokenSplit, formatUsd } from "@/lib/agents/llm-pricing";
import { useAgentRuns } from "@/lib/data/hooks";
import type { AgentId } from "@/types/agents";
import { useMemo } from "react";

interface AgentUsageSectionProps {
  agentId: AgentId;
}

function startOfTodayUtc(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function AgentUsageSection({ agentId }: AgentUsageSectionProps) {
  const { data: allRuns = [], isFetching, dataUpdatedAt } = useAgentRuns({ refetchInterval: 5000 });

  const stats = useMemo(() => {
    const runs = allRuns.filter((r) => r.agent_id === agentId);
    const todayStart = startOfTodayUtc();
    const todayRuns = runs.filter((r) => new Date(r.triggered_at).getTime() >= todayStart);

    let inputToday = 0;
    let outputToday = 0;
    let costToday = 0;
    let inputAll = 0;
    let outputAll = 0;
    let costAll = 0;

    for (const run of runs) {
      const hasSplit = typeof run.tokens_in === "number" || typeof run.tokens_out === "number";
      const split = hasSplit
        ? {
            input: run.tokens_in ?? 0,
            output: run.tokens_out ?? Math.max(0, (run.tokens_used ?? 0) - (run.tokens_in ?? 0)),
          }
        : estimateTokenSplit(run.model_used, run.tokens_used ?? 0, run.cost_usd ?? 0);

      inputAll += split.input;
      outputAll += split.output;
      costAll += run.cost_usd ?? 0;

      if (new Date(run.triggered_at).getTime() >= todayStart) {
        inputToday += split.input;
        outputToday += split.output;
        costToday += run.cost_usd ?? 0;
      }
    }

    return {
      runCount: runs.length,
      todayCount: todayRuns.length,
      inputToday,
      outputToday,
      costToday,
      inputAll,
      outputAll,
      costAll,
    };
  }, [allRuns, agentId]);

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="type-panel-title">Usage</h3>
          <p className="type-caption text-muted-foreground mt-1">
            Real-time token and dollar spend for this agent across users in your workspace.
            Refreshes every few seconds from recorded runs.
          </p>
        </div>
        <p className="type-caption text-muted-foreground">
          {isFetching ? "Updating…" : `Updated ${updatedLabel}`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UsageStat label="Input tokens (today)" value={stats.inputToday.toLocaleString()} />
        <UsageStat label="Output tokens (today)" value={stats.outputToday.toLocaleString()} />
        <UsageStat label="Cost today" value={formatUsd(stats.costToday)} />
        <UsageStat label="Runs today" value={String(stats.todayCount)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UsageStat label="Input tokens (all)" value={stats.inputAll.toLocaleString()} muted />
        <UsageStat label="Output tokens (all)" value={stats.outputAll.toLocaleString()} muted />
        <UsageStat label="Cost (all)" value={formatUsd(stats.costAll)} muted />
        <UsageStat label="Runs (all)" value={String(stats.runCount)} muted />
      </div>
    </section>
  );
}

function UsageStat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${muted ? "bg-muted/20" : "bg-background"}`}>
      <p className="type-caption text-muted-foreground">{label}</p>
      <p className="type-body font-mono mt-1 tabular-nums">{value}</p>
    </div>
  );
}
