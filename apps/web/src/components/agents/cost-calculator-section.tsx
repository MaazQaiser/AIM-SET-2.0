"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@dc-copilot/ui/components/label";
import { Input } from "@dc-copilot/ui/components/input";
import type { AgentId, CostCapConfig, ModelPolicy } from "@/types/agents";
import {
  COST_SCENARIOS,
  estimateLlmCostUsd,
  findModelPrice,
  formatUsd,
} from "@/lib/agents/llm-pricing";

interface CostCalculatorSectionProps {
  agentId: AgentId;
  modelPolicy: ModelPolicy;
  costCap: CostCapConfig;
}

export function CostCalculatorSection({
  agentId,
  modelPolicy,
  costCap,
}: CostCalculatorSectionProps) {
  const scenario = COST_SCENARIOS[agentId] ?? COST_SCENARIOS.content;
  const [inputTokens, setInputTokens] = useState(scenario.inputPerCall);
  const [outputTokens, setOutputTokens] = useState(scenario.outputPerCall);
  const [calls, setCalls] = useState(scenario.calls);

  useEffect(() => {
    setInputTokens(scenario.inputPerCall);
    setOutputTokens(scenario.outputPerCall);
    setCalls(scenario.calls);
  }, [agentId, scenario.inputPerCall, scenario.outputPerCall, scenario.calls]);

  const price = findModelPrice(modelPolicy.model_name);
  const perCall = useMemo(
    () => estimateLlmCostUsd(modelPolicy.model_name, inputTokens, outputTokens),
    [modelPolicy.model_name, inputTokens, outputTokens]
  );
  const total = perCall * Math.max(1, calls);
  const overCap = total > costCap.per_run_ceiling_usd;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="type-panel-title">Cost calculator</h3>
        <p className="type-caption text-muted-foreground mt-1">
          Estimate LLM spend for the selected primary model. Formula:{" "}
          <span className="font-mono">
            (input × $/1M + output × $/1M) / 1,000,000
          </span>
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-body font-medium">{scenario.label}</p>
          <p className="type-caption font-mono text-muted-foreground">
            {modelPolicy.model_name}
            {price
              ? ` · $${price.inputPer1M}/1M in · $${price.outputPer1M}/1M out`
              : ""}
          </p>
        </div>
        <p className="type-caption text-muted-foreground">{scenario.note}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="type-caption text-muted-foreground">Input tokens / call</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={inputTokens}
              onChange={(e) => setInputTokens(Number.parseInt(e.target.value, 10) || 0)}
              className="h-8 type-body"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="type-caption text-muted-foreground">Output tokens / call</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={outputTokens}
              onChange={(e) => setOutputTokens(Number.parseInt(e.target.value, 10) || 0)}
              className="h-8 type-body"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="type-caption text-muted-foreground">LLM calls / run</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={calls}
              onChange={(e) => setCalls(Number.parseInt(e.target.value, 10) || 1)}
              className="h-8 type-body"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
          <div>
            <p className="type-caption text-muted-foreground">Est. per call</p>
            <p className="type-body font-mono font-medium">{formatUsd(perCall)}</p>
          </div>
          <div>
            <p className="type-caption text-muted-foreground">Est. per run ({calls} calls)</p>
            <p className="type-body font-mono font-medium">{formatUsd(total)}</p>
          </div>
          <div>
            <p className="type-caption text-muted-foreground">Per-run ceiling</p>
            <p
              className={`type-body font-mono font-medium ${
                overCap ? "text-destructive" : ""
              }`}
            >
              {formatUsd(costCap.per_run_ceiling_usd)}
              {overCap ? " · estimate over cap" : ""}
            </p>
          </div>
        </div>

        {agentId === "live-call" ? (
          <p className="type-caption text-muted-foreground">
            Live calls also incur Recall meeting bot (~$0.65/hr recording + transcription). That
            cost is separate from this LLM estimate.
          </p>
        ) : null}
      </div>
    </section>
  );
}
