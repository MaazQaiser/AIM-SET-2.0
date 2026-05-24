"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { Label } from "@dc-copilot/ui/components/label";
import { Input } from "@dc-copilot/ui/components/input";
import { Slider } from "@dc-copilot/ui/components/slider";
import type { ThrottleConfig } from "@/types/agents";

interface NudgeThrottleControlProps {
  config: ThrottleConfig;
  onChange?: (config: ThrottleConfig) => void;
  readOnly?: boolean;
}

export function NudgeThrottleControl({ config, onChange, readOnly = false }: NudgeThrottleControlProps) {
  const [local, setLocal] = useState(config);

  function update(patch: Partial<ThrottleConfig>) {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Throttle Settings</span>
      </div>

      {/* Nudge rate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Max nudges per window</Label>
          <span className="text-sm font-semibold text-primary">{local.max_nudges_per_window}</span>
        </div>
        {readOnly ? (
          <div className="h-2 rounded-full bg-muted relative">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(local.max_nudges_per_window / 10) * 100}%` }}
            />
          </div>
        ) : (
          <Slider
            min={1}
            max={10}
            step={1}
            value={[local.max_nudges_per_window]}
            onValueChange={([v]) => update({ max_nudges_per_window: v })}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Spec default: 3 per 5-minute window. Increase carefully — nudge fatigue degrades adoption.
        </p>
      </div>

      {/* Window size */}
      <div className="space-y-2">
        <Label className="text-sm">Window size (seconds)</Label>
        <Input
          type="number"
          value={local.window_seconds}
          min={60}
          max={600}
          step={30}
          readOnly={readOnly}
          onChange={(e) => update({ window_seconds: Number(e.target.value) })}
          className="w-36 h-8 text-sm"
        />
      </div>

      {/* Max concurrent */}
      <div className="space-y-2">
        <Label className="text-sm">Max concurrent runs</Label>
        <Input
          type="number"
          value={local.max_concurrent_runs}
          min={1}
          max={20}
          readOnly={readOnly}
          onChange={(e) => update({ max_concurrent_runs: Number(e.target.value) })}
          className="w-36 h-8 text-sm"
        />
      </div>
    </div>
  );
}
