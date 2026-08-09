"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Label } from "@dc-copilot/ui/components/label";
import { Separator } from "@dc-copilot/ui/components/separator";
import { ModelPolicyBadge } from "./model-policy-badge";
import { WorkflowAgentConfigSections } from "./workflow-agent-config-sections";
import { GuardrailsConfigSection } from "./guardrails-config-section";
import { AgentUsageSection } from "./agent-usage-section";
import { MODEL_OPTIONS } from "@/lib/agents/llm-pricing";
import type { AgentConfig, AgentId } from "@/types/agents";

interface AgentConfigFormProps {
  agentId: AgentId;
  config: AgentConfig;
  onSave?: (config: AgentConfig) => void;
  readOnly?: boolean;
  isSaving?: boolean;
}

function selectModelValue(modelName: string): string {
  const match = MODEL_OPTIONS.find((m) => m.model === modelName);
  return match?.model ?? modelName;
}

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
  const primarySelect = selectModelValue(local.model_policy.model_name);
  const fallbackSelect = selectModelValue(local.model_policy.fallback_model_name);
  const knownModels = new Set(MODEL_OPTIONS.map((m) => m.model));

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="type-panel-title">Model</h3>
        <p className="type-caption text-muted-foreground">
          Primary and fallback models used when this agent calls the LLM.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="type-caption text-muted-foreground">Primary model</Label>
            {readOnly ? (
              <ModelPolicyBadge policy={local.model_policy} />
            ) : (
              <select
                value={primarySelect}
                onChange={(e) => {
                  const opt = MODEL_OPTIONS.find((m) => m.model === e.target.value);
                  if (!opt) return;
                  patch("model_policy", {
                    ...local.model_policy,
                    primary: opt.tier,
                    model_name: opt.model,
                  });
                }}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {!knownModels.has(local.model_policy.model_name) ? (
                  <option value={local.model_policy.model_name}>
                    Current: {local.model_policy.model_name}
                  </option>
                ) : null}
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.model} value={m.model}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="type-caption text-muted-foreground">Fallback model</Label>
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
                value={fallbackSelect}
                onChange={(e) => {
                  const opt = MODEL_OPTIONS.find((m) => m.model === e.target.value);
                  if (!opt) return;
                  patch("model_policy", {
                    ...local.model_policy,
                    fallback: opt.tier,
                    fallback_model_name: opt.model,
                  });
                }}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {!knownModels.has(local.model_policy.fallback_model_name) ? (
                  <option value={local.model_policy.fallback_model_name}>
                    Current: {local.model_policy.fallback_model_name}
                  </option>
                ) : null}
                {MODEL_OPTIONS.map((m) => (
                  <option key={`fb-${m.model}`} value={m.model}>
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
        <h3 className="type-panel-title">Prompt</h3>
        <p className="type-caption text-muted-foreground">
          Active prompt files from the repository. Override below applies on the next run when
          supported.
          {agentId === "workflow"
            ? " PRE-DC also has dedicated summary / artifact prompt editors below."
            : null}
        </p>
        {prompts.length === 0 ? (
          <p className="type-body text-muted-foreground">No prompt files on disk for this agent yet.</p>
        ) : (
          <ul className="space-y-2">
            {prompts.map((p) => (
              <li key={`${p.label}-${p.version}`} className="rounded-md border p-3 type-body">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {p.label} <span className="text-muted-foreground font-mono">v{p.version}</span>
                  </span>
                  {p.is_active ? (
                    <span className="type-label rounded bg-primary/10 text-primary px-2 py-0.5">
                      active
                    </span>
                  ) : null}
                </div>
                {"path" in p && p.path ? (
                  <p className="type-label font-mono text-muted-foreground mt-1">
                    prompts/{String(p.path)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <Label className="type-caption text-muted-foreground">System prompt override (optional)</Label>
          <textarea
            value={local.system_prompt_override ?? ""}
            readOnly={readOnly}
            rows={4}
            onChange={(e) => patch("system_prompt_override", e.target.value)}
            placeholder="Leave empty to use the repository prompt file."
            className="flex w-full rounded-md border bg-background px-3 py-2 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
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

      <GuardrailsConfigSection
        policy={local.guardrails}
        readOnly={readOnly}
        onChange={(g) => patch("guardrails", g)}
      />

      <Separator />

      <AgentUsageSection agentId={agentId} />

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
