"use client";

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { BANTScorecard } from "@/components/bant-scorecard";
import { Badge } from "@/components/ui/badge";
import {
  BriefDetailAccordion,
  BriefDetailCard,
  BriefDetailRow,
} from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import type { BANTScore } from "@/types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";

function bantEvidenceFromChecklist(state: DiscoveryChecklistState): Partial<Record<keyof BANTScore, string>> {
  const out: Partial<Record<keyof BANTScore, string>> = {};
  for (const item of state.items.filter((i) => i.tier === "bant")) {
    const snippet = item.evidence?.[0]?.snippet;
    if (snippet) {
      out[item.id as keyof BANTScore] = snippet;
    }
  }
  return out;
}

const statusLabel: Record<string, string> = {
  pending: "Open",
  partial: "Partial",
  confirmed: "Done",
  not_applicable: "N/A",
};

interface DiscoveryChecklistPanelProps {
  state: DiscoveryChecklistState | null;
  className?: string;
  /** full = live call sidebar; brief = minimal call detail with accordions */
  variant?: "full" | "brief";
}

export function DiscoveryChecklistPanel({
  state,
  className,
  variant = "full",
}: DiscoveryChecklistPanelProps) {
  if (!state) {
    return (
      <BriefDetailCard title="Discovery coverage" icon={ListChecks} className={className}>
        <p className="text-sm text-muted-foreground">
          Discovery checklist will populate when the call stream connects.
        </p>
      </BriefDetailCard>
    );
  }

  if (variant === "brief") {
    return <DiscoveryChecklistBriefCard state={state} className={className} />;
  }

  return <DiscoveryChecklistFullPanel state={state} className={className} />;
}

function DiscoveryChecklistBriefCard({
  state,
  className,
}: {
  state: DiscoveryChecklistState;
  className?: string;
}) {
  const bantPct = Math.round(state.bantCoverage * 100);
  const allPct = Math.round(state.coverage * 100);
  const secondary = state.items.filter((i) => i.tier === "secondary");
  const bantItems = state.items.filter((i) => i.tier === "bant");
  const bantComplete = bantPct >= 100;
  const openGapCount = state.openGaps.length;

  return (
    <BriefDetailCard
      title="Discovery coverage"
      icon={ListChecks}
      className={className}
      headerExtra={
        <div className="flex items-center gap-2 shrink-0">
          <CoverageRing percent={bantPct} label="BANT" />
          <Badge variant={bantComplete ? "success" : "secondary"} className="text-[10px]">
            {bantPct}% BANT
          </Badge>
        </div>
      }
    >
      <BriefDetailRow className="bg-primary/5 border-primary/20">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{bantPct}%</span> BANT ·{" "}
          <span className="font-semibold">{allPct}%</span> overall
          {openGapCount > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {openGapCount} open gap{openGapCount === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </BriefDetailRow>

      <div className="mt-3 space-y-2">
        <BriefDetailAccordion
          title="BANT breakdown"
          summary={`Budget, authority, need, timeline — ${bantPct}% covered`}
        >
          <BANTScorecard
            bant={state.bant}
            evidenceByDimension={bantEvidenceFromChecklist(state)}
            compact
            layout="stack"
          />
        </BriefDetailAccordion>

        {bantItems.length > 0 && (
          <BriefDetailAccordion
            title="BANT checklist items"
            summary={`${bantItems.filter((i) => i.status === "confirmed").length}/${bantItems.length} confirmed`}
          >
            <ChecklistItemList items={bantItems} />
          </BriefDetailAccordion>
        )}

        {openGapCount > 0 && (
          <BriefDetailAccordion
            title="Open gaps"
            summary={state.openGaps.map((g) => g.replace(/_/g, " ")).join(", ")}
          >
            <ul className="space-y-1.5">
              {state.openGaps.map((gap) => (
                <li key={gap} className="text-sm text-foreground capitalize">
                  {gap.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          </BriefDetailAccordion>
        )}

        {secondary.length > 0 && (
          <BriefDetailAccordion
            title="Secondary qualification"
            summary={`${secondary.filter((i) => i.status === "confirmed").length}/${secondary.length} complete`}
          >
            <ChecklistItemList items={secondary} />
          </BriefDetailAccordion>
        )}

        <BriefDetailAccordion title="Overall qualification" summary={`${allPct}% coverage`}>
          <p className="text-sm text-muted-foreground">
            Combined BANT and secondary discovery items for this call preview.
          </p>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${allPct}%` }}
            />
          </div>
        </BriefDetailAccordion>
      </div>
    </BriefDetailCard>
  );
}

function ChecklistItemList({
  items,
}: {
  items: DiscoveryChecklistState["items"];
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-2 text-sm min-w-0 rounded-md border border-border/60 px-2 py-1.5"
        >
          <span className="truncate text-foreground">{item.label}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {statusLabel[item.status] ?? item.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Original expanded panel for live call workspace */
function DiscoveryChecklistFullPanel({
  state,
  className,
}: {
  state: DiscoveryChecklistState;
  className?: string;
}) {
  const [showSecondary, setShowSecondary] = useState(false);
  const bantPct = Math.round(state.bantCoverage * 100);
  const allPct = Math.round(state.coverage * 100);
  const secondary = state.items.filter((i) => i.tier === "secondary");
  const bantComplete = bantPct >= 100;

  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Discovery coverage
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CoverageRing percent={bantPct} label="BANT" />
          <Badge variant={bantComplete ? "success" : "secondary"} className="text-[10px]">
            {bantPct}% BANT
          </Badge>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <BANTScorecard
          bant={state.bant}
          evidenceByDimension={bantEvidenceFromChecklist(state)}
          compact
          layout="row"
        />

        {state.openGaps.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Open: {state.openGaps.map((g) => g.replace(/_/g, " ")).join(", ")}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground">Overall qualification {allPct}%</p>

        {secondary.length > 0 && (
          <div>
            <button
              type="button"
              className="flex h-7 w-full items-center justify-between rounded-md px-2 text-xs hover:bg-muted/40"
              onClick={() => setShowSecondary((v) => !v)}
            >
              Secondary items ({secondary.filter((i) => i.status === "confirmed").length}/
              {secondary.length})
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform",
                  showSecondary && "rotate-180"
                )}
              />
            </button>
            {showSecondary && <ChecklistItemList items={secondary} />}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverageRing({ percent, label }: { percent: number; label: string }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div
      className="relative h-9 w-9 shrink-0"
      title={`${label} ${percent}%`}
      aria-label={`${label} coverage ${percent} percent`}
    >
      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" className="stroke-muted" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium">
        {percent}
      </span>
    </div>
  );
}
