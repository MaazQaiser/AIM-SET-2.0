"use client";

import { filterKeywordCounts } from "@/lib/live/keyword-filter";
import type { KeywordStats } from "@/types";
import { Badge } from "@dc-copilot/ui/components/badge";

interface KeywordFrequencyPanelProps {
  stats: KeywordStats | null;
}

export function KeywordFrequencyPanel({ stats }: KeywordFrequencyPanelProps) {
  if (!stats || (stats.global_top.length === 0 && Object.keys(stats.by_speaker).length === 0)) {
    return (
      <p className="type-caption text-muted-foreground">
        Keyword frequency updates as participants speak.
      </p>
    );
  }

  const globalTop = filterKeywordCounts(stats.global_top);

  return (
    <div className="space-y-2 type-label">
      {globalTop.length > 0 && (
        <div>
          <p className="font-semibold text-muted-foreground mb-1">
            Top keywords
          </p>
          <p className="type-caption text-muted-foreground mb-1.5">
            Industry &amp; tech terms only — fillers and common words hidden.
          </p>
          <div className="flex flex-wrap gap-1">
            {globalTop.slice(0, 8).map((k) => (
              <Badge key={k.term} variant="secondary" className="type-caption font-normal">
                {k.term} ×{k.count}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {Object.entries(stats.by_speaker).map(([speakerId, terms]) => {
        const filtered = filterKeywordCounts(terms);
        return filtered.length > 0 ? (
          <div key={speakerId}>
            <p className="type-caption text-muted-foreground mb-0.5 truncate">{speakerId}</p>
            <div className="flex flex-wrap gap-1">
              {filtered.slice(0, 5).map((k) => (
                <Badge key={`${speakerId}-${k.term}`} variant="outline" className="type-caption">
                  {k.term} ({k.count})
                </Badge>
              ))}
            </div>
          </div>
        ) : null;
      })}
    </div>
  );
}
