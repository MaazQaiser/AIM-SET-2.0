"use client";

import type { SuggestionLogEntry } from "@/types";

interface SuggestionLogProps {
  entries: SuggestionLogEntry[];
  compact?: boolean;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function SuggestionLog({ entries, compact }: SuggestionLogProps) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">AI suggestions will appear here with timestamps.</p>
    );
  }

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {!compact && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AI suggestion log
        </p>
      )}
      {[...entries].reverse().slice(0, 12).map((e, i) => (
        <div key={e.id ?? `${e.operation}-${i}`} className="text-[10px] text-muted-foreground flex gap-2">
          <span className="font-mono shrink-0">{formatTime(e.timestamp)}</span>
          <span className="truncate">
            <span className="text-foreground/80">{e.operation.replace(/_/g, " ")}</span>
            {e.summary ? ` — ${e.summary}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
