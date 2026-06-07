"use client";

import { useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import type { SignalRoutingRule, NudgeType, TargetRole } from "@/types/agents";
import { cn } from "@/lib/cn";

interface SignalRoutingTableProps {
  rules: SignalRoutingRule[];
  onChange?: (rules: SignalRoutingRule[]) => void;
  readOnly?: boolean;
}

const NUDGE_COLORS: Record<NudgeType, string> = {
  objection_handler:   "bg-red-100 text-red-700 border-red-200",
  reference_asset:     "bg-blue-100 text-blue-700 border-blue-200",
  discovery_question:  "bg-purple-100 text-purple-700 border-purple-200",
  risk_flag:           "bg-orange-100 text-orange-700 border-orange-200",
};

const ROLE_COLORS: Record<TargetRole, string> = {
  AE:       "bg-green-100 text-green-700",
  SE:       "bg-indigo-100 text-indigo-700",
  Designer: "bg-pink-100 text-pink-700",
  all:      "bg-muted text-muted-foreground",
};

export function SignalRoutingTable({ rules, onChange, readOnly = false }: SignalRoutingTableProps) {
  const [local, setLocal] = useState(rules);

  function update(next: SignalRoutingRule[]) {
    setLocal(next);
    onChange?.(next);
  }

  function toggle(id: string) {
    update(local.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }

  function remove(id: string) {
    update(local.filter((r) => r.id !== id));
  }

  function addRule() {
    const newRule: SignalRoutingRule = {
      id: crypto.randomUUID(),
      keyword_pattern: "",
      signal_type: "custom",
      nudge_type: "discovery_question",
      target_role: "AE",
      enabled: true,
      confidence_threshold: 0.7,
    };
    update([...local, newRule]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="type-body font-medium">Signal → Nudge Routing Rules</span>
        {!readOnly && (
          <Button variant="outline" size="sm" className="h-7 type-label" onClick={addRule}>
            <Plus className="h-3 w-3 mr-1" />
            Add rule
          </Button>
        )}
      </div>

      <div className="rounded-md border divide-y overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto_auto] gap-2 px-4 py-2 bg-muted/50 type-label text-muted-foreground">
          <span>Keyword pattern</span>
          <span>Nudge type</span>
          <span>Target role</span>
          <span>Threshold</span>
          <span />
        </div>

        {local.length === 0 && (
          <div className="px-4 py-6 text-center type-body text-muted-foreground">
            No routing rules defined
          </div>
        )}

        {local.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              "grid grid-cols-[2fr_1fr_1fr_auto_auto] gap-2 px-4 py-3 items-center",
              !rule.enabled && "opacity-50"
            )}
          >
            {readOnly ? (
              <span className="type-label font-mono">{rule.keyword_pattern || "—"}</span>
            ) : (
              <Input
                className="h-7 type-label font-mono"
                value={rule.keyword_pattern}
                placeholder="e.g. competitor|pricing"
                onChange={(e) =>
                  update(local.map((r) => r.id === rule.id ? { ...r, keyword_pattern: e.target.value } : r))
                }
              />
            )}

            <span className={cn("inline-flex rounded-full border px-2 py-0.5 type-caption font-medium w-fit", NUDGE_COLORS[rule.nudge_type])}>
              {rule.nudge_type.replace("_", " ")}
            </span>

            <span className={cn("inline-flex rounded-full px-2 py-0.5 type-caption font-medium w-fit", ROLE_COLORS[rule.target_role])}>
              {rule.target_role}
            </span>

            <span className="type-caption text-muted-foreground">{(rule.confidence_threshold * 100).toFixed(0)}%</span>

            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(rule.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                >
                  {rule.enabled
                    ? <ToggleRight className="h-4 w-4 text-primary" />
                    : <ToggleLeft className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => remove(rule.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Delete rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
