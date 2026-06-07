"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Label } from "@dc-copilot/ui/components/label";
import type { AgentConfig } from "@/types/agents";

const DEFAULT_SUMMARY_PLACEHOLDER =
  "Default loaded from prompts/workflow/summary/v1.0.0.md. Clear a field and save to reset to repo default.";

interface WorkflowAgentConfigSectionsProps {
  config: AgentConfig;
  readOnly?: boolean;
  onChange: (config: AgentConfig) => void;
}

export function WorkflowAgentConfigSections({
  config,
  readOnly = false,
  onChange,
}: WorkflowAgentConfigSectionsProps) {
  const prompts = config.workflow_prompts ??
    config.pre_dc_prompts ?? {
      summary: "",
      artifact_plan: "",
      artifact_fulfill: "",
    };
  const rules =
    config.summary_highlight_rules && config.summary_highlight_rules.length > 0
      ? config.summary_highlight_rules
      : [];

  function patchPrompts(key: keyof typeof prompts, value: string) {
    onChange({
      ...config,
      workflow_prompts: { ...prompts, [key]: value },
    });
  }

  function patchRules(next: AgentConfig["summary_highlight_rules"]) {
    onChange({ ...config, summary_highlight_rules: next });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="type-panel-title">AI summary prompt</h3>
        <p className="type-caption text-muted-foreground">
          Controls how PRE-DC Workflow writes the executive summary on the Pre-DC (Pre-call brief)
          screen. Use **double asterisks** in the prompt to instruct the model what to emphasize.
        </p>
        <div className="space-y-2">
          <Label className="type-caption text-muted-foreground">Summary override</Label>
          <textarea
            value={prompts.summary ?? ""}
            readOnly={readOnly}
            rows={6}
            placeholder={DEFAULT_SUMMARY_PLACEHOLDER}
            onChange={(e) => patchPrompts("summary", e.target.value)}
            className="flex w-full rounded-md border bg-background px-3 py-2 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="type-panel-title">Summary highlight rules</h3>
        <p className="type-caption text-muted-foreground">
          Regex patterns applied on the Pre-DC screen to color-key phrases in the PRE-DC Workflow summary.
          Defaults are pre-filled; edit or add rules, then save.
        </p>
        {rules.length === 0 ? (
          <p className="type-caption text-muted-foreground rounded-md border border-dashed p-3">
            No highlight rules loaded. Refresh the page — defaults should appear from the API. If this
            persists, check that the backend is running on port 8000.
          </p>
        ) : null}
        <ul className="space-y-3">
          {rules.map((rule, index) => (
            <li
              key={`${rule.pattern}-${rule.className}-${rule.flags ?? ""}`}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="flex justify-between items-center gap-2">
                <Label className="type-label">Pattern {index + 1}</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => patchRules(rules.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <input
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 type-body font-mono"
                value={rule.pattern}
                readOnly={readOnly}
                onChange={(e) => {
                  const next = [...rules];
                  next[index] = { ...rule, pattern: e.target.value };
                  patchRules(next);
                }}
                placeholder="\\b(budget|revenue)\\b"
              />
              <input
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 type-body font-mono"
                value={rule.className}
                readOnly={readOnly}
                onChange={(e) => {
                  const next = [...rules];
                  next[index] = { ...rule, className: e.target.value };
                  patchRules(next);
                }}
                placeholder="Tailwind classes for highlight"
              />
            </li>
          ))}
        </ul>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patchRules([
                ...rules,
                {
                  pattern: "",
                  className: "rounded px-1 py-0.5 bg-muted text-foreground",
                  flags: "gi",
                },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add highlight rule
          </Button>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="type-panel-title">Artifact planning prompt</h3>
        <p className="type-caption text-muted-foreground">
          Defines which decks, case studies, and one-pagers PRE-DC Workflow plans before the discovery
          call (shown on the Pre-DC screen).
        </p>
        <textarea
          value={prompts.artifact_plan ?? ""}
          readOnly={readOnly}
          rows={5}
          placeholder="Leave empty to use prompts/workflow/artifact_plan/v1.0.0.md"
          onChange={(e) => patchPrompts("artifact_plan", e.target.value)}
          className="flex w-full rounded-md border bg-background px-3 py-2 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
        />
      </section>

      <section className="space-y-4">
        <h3 className="type-panel-title">KB fulfillment prompt</h3>
        <p className="type-caption text-muted-foreground">
          How PRE-DC Workflow matches planned artifacts to KB chunks and what to show when content is
          missing on the Pre-DC screen.
        </p>
        <textarea
          value={prompts.artifact_fulfill ?? ""}
          readOnly={readOnly}
          rows={5}
          placeholder="Leave empty to use prompts/workflow/artifact_fulfill/v1.0.0.md"
          onChange={(e) => patchPrompts("artifact_fulfill", e.target.value)}
          className="flex w-full rounded-md border bg-background px-3 py-2 type-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
        />
      </section>
    </div>
  );
}
