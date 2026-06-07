"use client";

import type { PainSignal, CallIntent } from "@/types";
import { Badge } from "@dc-copilot/ui/components/badge";

interface IntentPainStreamProps {
  intent: CallIntent | null;
  pains: PainSignal[];
  nextActions?: string[];
}

export function IntentPainStream({ intent, pains, nextActions = [] }: IntentPainStreamProps) {
  if (!intent && pains.length === 0 && nextActions.length === 0) {
    return (
      <p className="type-caption text-muted-foreground px-1">
        Intent and pain points appear as the customer speaks.
      </p>
    );
  }

  return (
    <div className="space-y-3 type-label">
      {intent && (
        <div className="glass-insight-card p-2.5 shadow-none">
          <p className="font-semibold text-muted-foreground mb-1">
            Call intent
          </p>
          <p className="text-foreground font-medium">
            {intent.display ||
              (intent.label || "general_discovery").replace(/_/g, " ")}
          </p>
          {intent.evidence && (
            <p className="text-muted-foreground mt-1 line-clamp-2">&ldquo;{intent.evidence}&rdquo;</p>
          )}
        </div>
      )}
      {nextActions.length > 0 && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5">
          <p className="font-semibold text-muted-foreground mb-1.5">
            Next actions
          </p>
          <ul className="space-y-1.5">
            {nextActions.map((action) => (
              <li key={action} className="text-foreground leading-snug">
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pains.length > 0 && (
        <div>
          <p className="font-semibold text-muted-foreground mb-1.5">
            Pain points
          </p>
          <ul className="space-y-2">
            {pains.slice(-6).map((p) => (
              <li key={p.id} className="glass-insight-card p-2.5 shadow-none">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="type-caption px-1 py-0">
                    {p.source === "brief_match" ? "Brief" : "Live"}
                  </Badge>
                  <span className="type-caption text-muted-foreground">
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
