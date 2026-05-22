"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ModelPolicyBadge } from "./model-policy-badge";
import { NudgeThrottleControl } from "./nudge-throttle-control";
import { SignalRoutingTable } from "./signal-routing-table";
import { WorkflowAgentConfigSections } from "./workflow-agent-config-sections";
import type {
  AgentConfig,
  AgentId,
  ModelTier,
  CostAbortStrategy,
  FallbackStrategy,
} from "@/types/agents";

interface AgentConfigFormProps {
  agentId: AgentId;
  config: AgentConfig;
  onSave?: (config: AgentConfig) => void;
  readOnly?: boolean;
  isSaving?: boolean;
}

const MODEL_OPTIONS: { tier: ModelTier; model: string; label: string }[] = [
  { tier: "haiku", model: "claude-3-haiku-20240307", label: "Claude 3 Haiku (fast, cheap)" },
  { tier: "sonnet", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { tier: "opus", model: "claude-opus-4-7", label: "Claude Opus 4.7 (highest quality)" },
  { tier: "opus", model: "claude-3-opus-20240229", label: "Claude 3 Opus (legacy)" },
];

const ABORT_OPTIONS: CostAbortStrategy[] = ["hard_stop", "degrade", "alert_only"];
const FALLBACK_OPTIONS: FallbackStrategy[] = ["serve_from_cache", "degrade_gracefully", "alert_and_skip"];

export function AgentConfigForm({
  agentId,
  config,
  onSave,
  readOnly = false,
  isSaving = false,
}: AgentConfigFormProps) {
  const [local, setLocal] = useState(config);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal(config);
    setDirty(false);
  }, [config]);

  function patch<T>(section: keyof AgentConfig, value: T) {
    setLocal((prev) => ({ ...prev, [section]: value }));
    setDirty(true);
  }

  function handleSave() {
    onSave?.(local);
    setDirty(false);
  }

  function handleReset() {
    setLocal(config);
    setDirty(false);
  }

  const prompts = local.active_prompt_versions ?? [];
  const operations = local.operations ?? config.operations ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded-md border bg-muted/30 p-4 space-y-2">
        <h3 className="text-sm font-semibold">Agent in this project</h3>
        <p className="text-xs text-muted-foreground">
          {local.profile?.identity?.role ?? "Specialist agent"} — domains:{" "}
          {(local.profile?.identity?.allowed_domains ?? []).join(", ") || "—"}
        </p>
        {operations.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Operations: <span className="font-mono">{operations.join(", ")}</span>
          </p>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Model policy</h3>
        <p className="text-xs text-muted-foreground">
          Primary and fallback models used when this agent calls the LLM.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Primary model</Label>
            {readOnly ? (
              <ModelPolicyBadge policy={local.model_policy} />
            ) : (
              <select
                value={local.model_policy.primary}
                onChange={(e) => {
                  const opt = MODEL_OPTIONS.find((m) => m.tier === e.target.value);
                  if (!opt) return;
                  patch("model_policy", {
                    ...local.model_policy,
                    primary: opt.tier,
                    model_name: opt.model,
                  });
                }}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.tier + m.model} value={m.tier}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Fallback model</Label>
            {readOnly ? (
              <ModelPolicyBadge
                policy={{
                  ...local.model_policy,
                  primary: local.model_policy.fallback,
                  model_name: local.model_policy.fallback_model_name,
                }}
              />
            ) : (
              <select
                value={local.model_policy.fallback}
                onChange={(e) => {
                  const opt = MODEL_OPTIONS.find((m) => m.tier === e.target.value);
                  if (!opt) return;
                  patch("model_policy", {
                    ...local.model_policy,
                    fallback: opt.tier,
                    fallback_model_name: opt.model,
                  });
                }}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.tier + m.model} value={m.tier}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Cost controls</h3>
        <p className="text-xs text-muted-foreground">
          Enforced per agent run. Studio also tracks cumulative project spend against the project ceiling.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Per-run ceiling (USD)</Label>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={local.cost_cap.per_run_ceiling_usd}
              readOnly={readOnly}
              onChange={(e) =>
                patch("cost_cap", {
                  ...local.cost_cap,
                  per_run_ceiling_usd: parseFloat(e.target.value) || 0,
                })
              }
              className="w-36 h-8 text-sm"
            />
          </div>
          {agentId === "content_generation" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Project ceiling (USD)</Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={local.cost_cap.project_ceiling_usd ?? 1.5}
                readOnly={readOnly}
                onChange={(e) =>
                  patch("cost_cap", {
                    ...local.cost_cap,
                    project_ceiling_usd: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-36 h-8 text-sm"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">When cap is hit</Label>
            {readOnly ? (
              <span className="text-sm font-mono">{local.cost_cap.abort_strategy}</span>
            ) : (
              <select
                value={local.cost_cap.abort_strategy}
                onChange={(e) =>
                  patch("cost_cap", {
                    ...local.cost_cap,
                    abort_strategy: e.target.value as CostAbortStrategy,
                  })
                }
                className="flex h-9 w-48 rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ABORT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Throttle</h3>
        <NudgeThrottleControl
          config={local.throttle}
          readOnly={readOnly}
          onChange={(t) => patch("throttle", t)}
        />
      </section>

      {agentId === "live-call" && local.signal_routing !== undefined && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold mb-3">Signal routing</h3>
            <SignalRoutingTable
              rules={local.signal_routing}
              readOnly={readOnly}
              onChange={(r) => patch("signal_routing", r)}
            />
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Failure behaviour</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Max retries</Label>
            <Input
              type="number"
              min={0}
              max={5}
              value={local.failure_behaviour.max_retries}
              readOnly={readOnly}
              onChange={(e) =>
                patch("failure_behaviour", {
                  ...local.failure_behaviour,
                  max_retries: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-24 h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Retry delay (ms)</Label>
            <Input
              type="number"
              min={100}
              step={100}
              value={local.failure_behaviour.retry_delay_ms}
              readOnly={readOnly}
              onChange={(e) =>
                patch("failure_behaviour", {
                  ...local.failure_behaviour,
                  retry_delay_ms: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-24 h-8 text-sm"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Fallback strategy</Label>
            {readOnly ? (
              <span className="text-sm font-mono">{local.failure_behaviour.fallback_strategy}</span>
            ) : (
              <select
                value={local.failure_behaviour.fallback_strategy}
                onChange={(e) =>
                  patch("failure_behaviour", {
                    ...local.failure_behaviour,
                    fallback_strategy: e.target.value as FallbackStrategy,
                  })
                }
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {FALLBACK_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {agentId === "workflow" && (
        <>
          <Separator />
          <WorkflowAgentConfigSections
            config={local}
            readOnly={readOnly}
            onChange={(next) => {
              setLocal(next);
              setDirty(true);
            }}
          />
        </>
      )}

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Prompts</h3>
        <p className="text-xs text-muted-foreground">
          Active prompt files from the repository. Override below applies on the next run when supported.
        </p>
        {prompts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prompt files on disk for this agent yet.</p>
        ) : (
          <ul className="space-y-2">
            {prompts.map((p) => (
              <li key={`${p.label}-${p.version}`} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {p.label} <span className="text-muted-foreground font-mono">v{p.version}</span>
                  </span>
                  {p.is_active ? (
                    <span className="text-xs rounded bg-primary/10 text-primary px-2 py-0.5">active</span>
                  ) : null}
                </div>
                {"path" in p && p.path ? (
                  <p className="text-xs font-mono text-muted-foreground mt-1">prompts/{String(p.path)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">System prompt override (optional)</Label>
          <textarea
            value={local.system_prompt_override ?? ""}
            readOnly={readOnly}
            rows={4}
            onChange={(e) => patch("system_prompt_override", e.target.value)}
            placeholder="Leave empty to use the repository prompt file."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </div>
      </section>

      {!readOnly && (
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={!dirty || isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : "Save settings"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty || isSaving} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
