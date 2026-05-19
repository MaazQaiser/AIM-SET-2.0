"use client";

import { useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ModelPolicyBadge } from "./model-policy-badge";
import { NudgeThrottleControl } from "./nudge-throttle-control";
import { SignalRoutingTable } from "./signal-routing-table";
import { PromptVersionControl } from "./prompt-version-control";
import type {
  AgentConfig,
  AgentId,
  ModelTier,
  CostAbortStrategy,
  FallbackStrategy,
  RiskTier,
  GuardrailSeverity,
  GuardrailMode,
} from "@/types/agents";

interface AgentConfigFormProps {
  agentId: AgentId;
  config: AgentConfig;
  onSave?: (config: AgentConfig) => void;
  readOnly?: boolean;
}

const MODEL_OPTIONS: { tier: ModelTier; model: string; label: string }[] = [
  { tier: "haiku",  model: "claude-3-haiku-20240307",         label: "Claude 3 Haiku (fast, cheap)" },
  { tier: "sonnet", model: "claude-3-5-sonnet-20241022",      label: "Claude 3.5 Sonnet (balanced)" },
  { tier: "opus",   model: "claude-3-opus-20240229",          label: "Claude 3 Opus (most capable)" },
];

const ABORT_OPTIONS: CostAbortStrategy[] = ["hard_stop", "degrade", "alert_only"];
const FALLBACK_OPTIONS: FallbackStrategy[] = ["serve_from_cache", "degrade_gracefully", "alert_and_skip"];
const RISK_TIER_OPTIONS: RiskTier[] = ["low", "medium", "high"];
const GUARDRAIL_SEVERITY_OPTIONS: GuardrailSeverity[] = ["info", "warn", "block"];
const GUARDRAIL_MODE_OPTIONS: GuardrailMode[] = ["shadow", "enforce"];

export function AgentConfigForm({ agentId, config, onSave, readOnly = false }: AgentConfigFormProps) {
  const [local, setLocal] = useState(config);
  const [dirty, setDirty] = useState(false);

  function patch<T>(section: keyof AgentConfig, value: T) {
    setLocal((prev) => ({ ...prev, [section]: value }));
    setDirty(true);
  }

  function save() {
    onSave?.(local);
    setDirty(false);
  }

  function reset() {
    setLocal(config);
    setDirty(false);
  }

  return (
    <div className="space-y-8">
      {/* ── Agent Profile (versioned) ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Agent Profile</h3>
            <p className="text-xs text-muted-foreground mt-1">Versioned runtime identity, memory, and escalation settings.</p>
          </div>
          <span className="text-xs rounded border px-2 py-1 text-muted-foreground">
            v{local.profile.profile_version} · rev {local.profile.immutable_revision}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Risk tier</Label>
            {readOnly ? (
              <span className="text-sm font-mono">{local.profile.risk_tier}</span>
            ) : (
              <select
                value={local.profile.risk_tier}
                onChange={(e) =>
                  patch("profile", {
                    ...local.profile,
                    risk_tier: e.target.value as RiskTier,
                  })
                }
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {RISK_TIER_OPTIONS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Latency budget (ms)</Label>
            <Input
              type="number"
              min={300}
              step={100}
              value={local.profile.runtime.latency_budget_ms}
              readOnly={readOnly}
              onChange={(e) =>
                patch("profile", {
                  ...local.profile,
                  runtime: { ...local.profile.runtime, latency_budget_ms: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Session TTL (seconds)</Label>
            <Input
              type="number"
              min={60}
              step={60}
              value={local.profile.memory.session_ttl_seconds}
              readOnly={readOnly}
              onChange={(e) =>
                patch("profile", {
                  ...local.profile,
                  memory: { ...local.profile.memory, session_ttl_seconds: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full h-8 text-sm"
            />
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <p className="text-xs font-medium">Escalation policy</p>
          <p className="text-xs text-muted-foreground">
            Enabled: {local.profile.escalation.enabled ? "yes" : "no"} · max auto attempts: {local.profile.escalation.max_auto_attempts} · threshold: {local.profile.escalation.confidence_threshold}
          </p>
          <p className="text-xs text-muted-foreground">
            Triggers: {local.profile.escalation.triggers.join(", ")}
          </p>
        </div>
      </section>

      <Separator />

      {/* ── Model Policy ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Model Policy</h3>
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
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.tier} value={m.tier}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Fallback model</Label>
            {readOnly ? (
              <ModelPolicyBadge policy={{ ...local.model_policy, primary: local.model_policy.fallback, model_name: local.model_policy.fallback_model_name }} />
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
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.tier} value={m.tier}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Guardrails ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Guardrails</h3>
          <p className="text-xs text-muted-foreground mt-1">Execution order: pre-input → in-generation → post-output.</p>
        </div>

        {([
          ["Pre-input", local.guardrails.pre_input, "pre_input"],
          ["In-generation", local.guardrails.in_generation, "in_generation"],
          ["Post-output", local.guardrails.post_output, "post_output"],
        ] as const).map(([label, stage, stageKey]) => (
          <div key={label} className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <span className="text-xs text-muted-foreground">order {stage.execution_order}</span>
            </div>

            {stage.rules.map((rule) => (
              <div key={rule.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center border rounded-md p-2 bg-muted/20">
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium">{rule.name}</p>
                  <p className="text-[11px] text-muted-foreground">{rule.description}</p>
                </div>
                <select
                  value={rule.severity}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch("guardrails", {
                      ...local.guardrails,
                      [stageKey]: {
                        ...stage,
                        rules: stage.rules.map((r) =>
                          r.id === rule.id ? { ...r, severity: e.target.value as GuardrailSeverity } : r,
                        ),
                      },
                    })
                  }
                  className="flex h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {GUARDRAIL_SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <select
                  value={rule.mode}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch("guardrails", {
                      ...local.guardrails,
                      [stageKey]: {
                        ...stage,
                        rules: stage.rules.map((r) =>
                          r.id === rule.id ? { ...r, mode: e.target.value as GuardrailMode } : r,
                        ),
                      },
                    })
                  }
                  className="flex h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {GUARDRAIL_MODE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}
      </section>

      <Separator />

      {/* ── Workflow ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Workflow State Machine</h3>
          <p className="text-xs text-muted-foreground mt-1">Deterministic transitions with retry and escalation controls.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">States</p>
            <p className="text-sm mt-1">{local.workflow.states.join(" -> ")}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Policy controls</p>
            <p className="text-sm mt-1">Max iterations: {local.workflow.policy.max_tool_iterations}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Parallel readonly: {local.workflow.policy.allow_parallel_readonly_subtasks ? "on" : "off"} · idempotency required: {local.workflow.policy.require_idempotency_for_side_effects ? "yes" : "no"}
            </p>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Observability and Rollout ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Observability and Rollout</h3>
          <p className="text-xs text-muted-foreground mt-1">Metrics, audit policy, and progressive release stages.</p>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Required event fields</p>
          <p className="text-sm">{local.observability.event_schema.required_fields.join(", ")}</p>
          <p className="text-xs text-muted-foreground">
            Tracing: {local.observability.tracing_enabled ? "enabled" : "disabled"} · Immutable audit: {local.observability.audit.immutable_log ? "yes" : "no"} · Retention: {local.observability.audit.retention_days} days
          </p>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Current rollout stage</p>
          <p className="text-sm font-medium">{local.rollout.current_stage}</p>
          <p className="text-xs text-muted-foreground">
            Enabled stages: {local.rollout.stages.filter((stage) => stage.enabled).map((stage) => stage.stage).join(", ")}
          </p>
        </div>
      </section>

      <Separator />

      {/* ── Cost Caps ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Cost Caps</h3>
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
                patch("cost_cap", { ...local.cost_cap, per_run_ceiling_usd: parseFloat(e.target.value) })
              }
              className="w-36 h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">When cap is hit</Label>
            {readOnly ? (
              <span className="text-sm font-mono">{local.cost_cap.abort_strategy}</span>
            ) : (
              <select
                value={local.cost_cap.abort_strategy}
                onChange={(e) =>
                  patch("cost_cap", { ...local.cost_cap, abort_strategy: e.target.value as CostAbortStrategy })
                }
                className="flex h-9 w-48 rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ABORT_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o.replace("_", " ")}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Throttle ─────────────────────────────────────────────────────── */}
      <section>
        <NudgeThrottleControl
          config={local.throttle}
          readOnly={readOnly}
          onChange={(t) => patch("throttle", t)}
        />
      </section>

      {/* ── Signal Routing (Live Call only) ──────────────────────────────── */}
      {agentId === "live-call" && local.signal_routing !== undefined && (
        <>
          <Separator />
          <section>
            <SignalRoutingTable
              rules={local.signal_routing}
              readOnly={readOnly}
              onChange={(r) => patch("signal_routing", r)}
            />
          </section>
        </>
      )}

      <Separator />

      {/* ── Failure Behaviour ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Failure Behaviour</h3>
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
                patch("failure_behaviour", { ...local.failure_behaviour, max_retries: parseInt(e.target.value) })
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
                patch("failure_behaviour", { ...local.failure_behaviour, retry_delay_ms: parseInt(e.target.value) })
              }
              className="w-24 h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
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
                  <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Alert on failure</Label>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="alert_on_failure"
                checked={local.failure_behaviour.alert_on_failure}
                disabled={readOnly}
                onChange={(e) =>
                  patch("failure_behaviour", { ...local.failure_behaviour, alert_on_failure: e.target.checked })
                }
                className="h-4 w-4 rounded border"
              />
              <label htmlFor="alert_on_failure" className="text-sm">Enabled</label>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Prompt Versions ──────────────────────────────────────────────── */}
      <section>
        <PromptVersionControl
          versions={local.active_prompt_versions}
          onRollback={readOnly ? undefined : (v) => {
            patch("active_prompt_versions", local.active_prompt_versions.map((pv) => ({
              ...pv,
              is_active: pv.version === v.version,
            })));
          }}
        />
      </section>

      {/* ── Save / Reset ─────────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={!dirty} className="gap-2">
            <Save className="h-4 w-4" />
            Save changes
          </Button>
          <Button variant="ghost" onClick={reset} disabled={!dirty} className="gap-2 text-muted-foreground">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          {dirty && (
            <span className="text-xs text-warning font-medium">Unsaved changes</span>
          )}
        </div>
      )}
    </div>
  );
}
