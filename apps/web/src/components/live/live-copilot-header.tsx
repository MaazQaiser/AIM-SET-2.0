"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { BantLiveStatusBars } from "@/components/live/bant-live-status-bars";
import { BantLiveTiles } from "@/components/live/live-metrics-rail";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import { cn } from "@/lib/cn";

interface LiveCopilotHeaderProps {
  checklist: DiscoveryChecklistState | null;
  defaultOpen?: boolean;
}

export function LiveCopilotHeader({ checklist, defaultOpen = false }: LiveCopilotHeaderProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="shrink-0 border-b border-border/60">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted/30"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Live copilot
          </span>
        </div>
        <BantLiveStatusBars checklist={checklist} />
      </button>
      {open && (
        <div className="border-t border-border/40 px-5 pb-3 pt-2">
          <BantLiveTiles checklist={checklist} />
        </div>
      )}
    </div>
  );
}
