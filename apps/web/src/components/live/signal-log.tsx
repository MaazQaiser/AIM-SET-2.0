"use client";

import type { BantSignal } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

interface SignalLogProps {
  signals: BantSignal[];
  className?: string;
}

const DIM_COLOR: Record<BantSignal["dimension"], string> = {
  budget: "bg-blue-100 text-blue-800",
  authority: "bg-purple-100 text-purple-800",
  need: "bg-green-100 text-green-800",
  timeline: "bg-orange-100 text-orange-800",
};

export function SignalLog({ signals, className }: SignalLogProps) {
  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Signal log
      </div>
      <div className="max-h-32 overflow-y-auto divide-y">
        {signals.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No signals yet</p>
        ) : (
          signals.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className={cn("rounded px-1.5 py-0.5 font-medium uppercase", DIM_COLOR[s.dimension])}>
                {s.dimension}
              </span>
              <span className="text-foreground flex-1 truncate">{s.label}</span>
              <span className="text-muted-foreground font-mono shrink-0">
                {Math.floor(s.timestamp / 60)}:{String(s.timestamp % 60).padStart(2, "0")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
