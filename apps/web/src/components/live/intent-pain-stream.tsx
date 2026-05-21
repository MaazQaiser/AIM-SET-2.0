"use client";

import type { PainSignal, CallIntent } from "@/types";
import { Badge } from "@/components/ui/badge";

interface IntentPainStreamProps {
  intent: CallIntent | null;
  pains: PainSignal[];
}

export function IntentPainStream({ intent, pains }: IntentPainStreamProps) {
  if (!intent && pains.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1">
        Intent and pain points appear as the customer speaks.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {intent && (
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Call intent
          </p>
          <p className="text-foreground font-medium capitalize">
            {(intent.label || "general_discovery").replace(/_/g, " ")}
          </p>
          {intent.evidence && (
            <p className="text-muted-foreground mt-1 line-clamp-2">&ldquo;{intent.evidence}&rdquo;</p>
          )}
        </div>
      )}
      {pains.length > 0 && (
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Pain points
          </p>
          <ul className="space-y-2">
            {pains.slice(-6).map((p) => (
              <li key={p.id} className="rounded-md border border-border p-2 bg-card">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {p.source === "brief_match" ? "Brief" : "Live"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(p.confidence * 100)}%
                  </span>
                </div>
                <p className="text-foreground leading-snug">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
