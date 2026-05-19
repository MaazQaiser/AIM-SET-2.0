"use client";

import type { BantSignal } from "@/lib/live-types";
import { Badge } from "@/components/ui/badge";

interface SignalLogProps {
  signals: BantSignal[];
}

const dimLabel: Record<BantSignal["dimension"], string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

export function SignalLog({ signals }: SignalLogProps) {
  if (signals.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        BANT signals will appear as the conversation progresses.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((s) => (
        <Badge key={s.id} variant="outline" className="text-[10px] font-normal">
          {dimLabel[s.dimension]} · {s.label}
        </Badge>
      ))}
    </div>
  );
}
