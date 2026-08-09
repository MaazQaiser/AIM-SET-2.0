"use client";

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

  function patchPrompts(key: keyof typeof prompts, value: string) {
    onChange({
      ...config,
      workflow_prompts: { ...prompts, [key]: value },
    });
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
