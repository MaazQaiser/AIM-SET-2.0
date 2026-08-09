"use client";

import { Label } from "@dc-copilot/ui/components/label";
import type {
  GuardrailMode,
  GuardrailPolicy,
  GuardrailRule,
  GuardrailSeverity,
  GuardrailStage,
} from "@/types/agents";

interface GuardrailsConfigSectionProps {
  policy: GuardrailPolicy;
  readOnly?: boolean;
  onChange: (policy: GuardrailPolicy) => void;
}

const STAGES: { key: keyof Pick<GuardrailPolicy, "pre_input" | "in_generation" | "post_output">; title: string }[] =
  [
    { key: "pre_input", title: "Pre-input" },
    { key: "in_generation", title: "In generation" },
    { key: "post_output", title: "Post-output" },
  ];

const SEVERITIES: GuardrailSeverity[] = ["info", "warn", "block"];
const MODES: GuardrailMode[] = ["shadow", "enforce"];

function patchRule(
  stage: GuardrailStage,
  ruleId: string,
  patch: Partial<GuardrailRule>
): GuardrailStage {
  return {
    ...stage,
    rules: stage.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
  };
}

export function GuardrailsConfigSection({
  policy,
  readOnly = false,
  onChange,
}: GuardrailsConfigSectionProps) {
  function updateStage(
    key: "pre_input" | "in_generation" | "post_output",
    stage: GuardrailStage
  ) {
    onChange({ ...policy, [key]: stage });
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="type-panel-title">Guardrails</h3>
        <p className="type-caption text-muted-foreground mt-1">
          Input, generation, and output policy rules. Shadow logs only; enforce can block or warn.
          Policy version {policy.policy_version}.
        </p>
      </div>

      <div className="space-y-6">
        {STAGES.map(({ key, title }) => {
          const stage = policy[key];
          return (
            <div key={key} className="space-y-3">
              <h4 className="type-body font-medium">
                {title}{" "}
                <span className="type-caption text-muted-foreground font-normal">
                  (order {stage.execution_order})
                </span>
              </h4>
              <ul className="space-y-3">
                {stage.rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="rounded-md border bg-background p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="type-body font-medium">{rule.name}</p>
                        <p className="type-caption text-muted-foreground mt-0.5">
                          {rule.description}
                        </p>
                        <p className="type-label font-mono text-muted-foreground mt-1">
                          {rule.id}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateStage(
                              key,
                              patchRule(stage, rule.id, { enabled: e.target.checked })
                            )
                          }
                          className="h-4 w-4 rounded border"
                        />
                        <span className="type-caption">Enabled</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="type-caption text-muted-foreground">Severity</Label>
                        {readOnly ? (
                          <span className="type-body font-mono">{rule.severity}</span>
                        ) : (
                          <select
                            value={rule.severity}
                            onChange={(e) =>
                              updateStage(
                                key,
                                patchRule(stage, rule.id, {
                                  severity: e.target.value as GuardrailSeverity,
                                })
                              )
                            }
                            className="flex h-9 w-full rounded-md border bg-background px-3 py-1 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {SEVERITIES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="type-caption text-muted-foreground">Mode</Label>
                        {readOnly ? (
                          <span className="type-body font-mono">{rule.mode}</span>
                        ) : (
                          <select
                            value={rule.mode}
                            onChange={(e) =>
                              updateStage(
                                key,
                                patchRule(stage, rule.id, {
                                  mode: e.target.value as GuardrailMode,
                                })
                              )
                            }
                            className="flex h-9 w-full rounded-md border bg-background px-3 py-1 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {MODES.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
