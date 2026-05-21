"use client";

import type { KeywordStats } from "@/types";
import { Badge } from "@/components/ui/badge";

interface KeywordFrequencyPanelProps {
  stats: KeywordStats | null;
}

export function KeywordFrequencyPanel({ stats }: KeywordFrequencyPanelProps) {
  if (!stats || (stats.global_top.length === 0 && Object.keys(stats.by_speaker).length === 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        Keyword frequency updates as participants speak.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {stats.global_top.length > 0 && (
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Top keywords
          </p>
          <div className="flex flex-wrap gap-1">
            {stats.global_top.slice(0, 8).map((k) => (
              <Badge key={k.term} variant="secondary" className="text-[10px] font-normal">
                {k.term} ×{k.count}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {Object.entries(stats.by_speaker).map(([speakerId, terms]) =>
        terms.length > 0 ? (
          <div key={speakerId}>
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{speakerId}</p>
            <div className="flex flex-wrap gap-1">
              {terms.slice(0, 5).map((k) => (
                <Badge key={`${speakerId}-${k.term}`} variant="outline" className="text-[9px]">
                  {k.term} ({k.count})
                </Badge>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
