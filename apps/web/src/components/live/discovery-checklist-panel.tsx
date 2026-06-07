"use client";

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { BANTScorecard } from "@/components/bant-scorecard";
import { Badge } from "@dc-copilot/ui/components/badge";
import {
  BriefDetailAccordion,
  BriefDetailCard,
  BriefDetailRow,
} from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import { formatBudgetUsd } from "@/lib/currency-format";
import {
  checklistDisplayGaps,
  formatChecklistDisplayGaps,
} from "@/lib/live/bant-display";
import type { BANTScore } from "@/types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";

function bantEvidenceFromChecklist(
  state: DiscoveryChecklistState
): Partial<Record<keyof BANTScore, string>> {
  const out: Partial<Record<keyof BANTScore, string>> = {};
  for (const item of state.items.filter((i) => i.tier === "bant")) {
    const evidence = item.evidence?.[item.evidence.length - 1];
    const text = evidence?.value || evidence?.snippet;
    if (text) {
      const displayText = item.id === "budget" ? formatBudgetUsd(text) : text;
      out[item.id as keyof BANTScore] =
        evidence?.sentiment === "negative" ? `Customer concern: ${displayText}` : displayText;
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
  /** Body only — used inside Pre-DC prep sidebar card */
  embedded?: boolean;
  /** When BANT scorecard is shown above, omit duplicate BANT breakdown/items */
  suppressBantSections?: boolean;
}

export function DiscoveryChecklistPanel({
  state,
  className,
  variant = "full",
  embedded = false,
  suppressBantSections = false,
}: DiscoveryChecklistPanelProps) {
  if (!state) {
    if (embedded) {
      return (
        <p className={cn("type-body text-muted-foreground", className)}>
          Discovery checklist will populate when the call stream connects.
        </p>
      );
    }
    return (
      <BriefDetailCard title="Discovery coverage" icon={ListChecks} className={className}>
        <p className="type-body text-muted-foreground">
          Discovery checklist will populate when the call stream connects.
        </p>
      </BriefDetailCard>
    );
  }

  if (variant === "brief") {
    return (
      <DiscoveryChecklistBriefCard
        state={state}
        className={className}
        embedded={embedded}
        suppressBantSections={suppressBantSections}
      />
    );
  }

  return <DiscoveryChecklistFullPanel state={state} className={className} />;
}

function DiscoveryChecklistBriefCard({
  state,
  className,
  embedded = false,
  suppressBantSections = false,
}: {
  state: DiscoveryChecklistState;
  className?: string;
  embedded?: boolean;
  suppressBantSections?: boolean;
}) {
  const bantPct = Math.round(state.bantCoverage * 100);
  const allPct = Math.round(state.coverage * 100);
  const secondary = state.items.filter((i) => i.tier === "secondary");
  const bantItems = state.items.filter((i) => i.tier === "bant");
  const bantComplete = bantPct >= 100;
  const openGapCount = state.openGaps.length;
  const gapSummary = formatChecklistDisplayGaps(state);

  const headerExtra = (
    <div className="flex items-center gap-2 shrink-0">
      <CoverageRing percent={bantPct} label="BANT" />
      <Badge variant={bantComplete ? "success" : "secondary"} className="type-caption">
        {bantPct}% BANT
      </Badge>
    </div>
  );

  const body = (
    <>
      {suppressBantSections ? (
        <ChecklistCoverageProgress percent={allPct} openGapCount={openGapCount} />
      ) : (
        <BriefDetailRow className="bg-primary/5 border-primary/20">
          <p className="type-body font-medium text-foreground">
            <span className="font-extrabold">{bantPct}%</span> BANT ·{" "}
            <span className="font-extrabold">{allPct}%</span> overall
            {openGapCount > 0 && (
              <span className="text-muted-foreground font-medium">
                {" "}
                · {openGapCount} open gap{openGapCount === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </BriefDetailRow>
      )}

      <div className={cn(suppressBantSections ? "mt-4" : "mt-3", "space-y-2")}>
        {!suppressBantSections && (
          <BriefDetailAccordion
            title="BANT breakdown"
            summary={`Budget, authority, need, timeline — ${bantPct}% covered`}
            loud
          >
            <BANTScorecard
              bant={state.bant}
              evidenceByDimension={bantEvidenceFromChecklist(state)}
              compact
              layout="stack"
            />
          </BriefDetailAccordion>
        )}

        {!suppressBantSections && bantItems.length > 0 && (
          <BriefDetailAccordion
            title="BANT checklist items"
            summary={`${bantItems.filter((i) => i.status === "confirmed").length}/${bantItems.length} confirmed`}
            loud
          >
            <ChecklistItemList items={bantItems} />
          </BriefDetailAccordion>
        )}

        {gapSummary && (
          <BriefDetailAccordion
            title="Coverage gaps"
            summary={gapSummary}
            loud
          >
            <ChecklistGapList state={state} />
          </BriefDetailAccordion>
        )}

        {secondary.length > 0 && (
          <BriefDetailAccordion
            title="Secondary qualification"
            summary={`${secondary.filter((i) => i.status === "confirmed").length}/${secondary.length} complete`}
            loud
          >
            <ChecklistItemList items={secondary} />
          </BriefDetailAccordion>
        )}

        {!embedded && (
          <BriefDetailAccordion title="Overall qualification" summary={`${allPct}% coverage`} loud>
            <ChecklistCoverageProgress percent={allPct} openGapCount={openGapCount} />
          </BriefDetailAccordion>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className={cn("min-w-0", className)}>{body}</div>;
  }

  return (
    <BriefDetailCard
      title="Discovery coverage"
      icon={ListChecks}
      className={className}
      headerExtra={headerExtra}
    >
      {body}
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
          className="flex items-center justify-between gap-2 type-body min-w-0 rounded-md border border-border/60 px-2 py-1.5"
        >
          <span className="truncate text-foreground">{item.label}</span>
          <Badge variant="outline" className="type-caption shrink-0">
            {statusLabel[item.status] ?? item.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function ChecklistGapList({ state }: { state: DiscoveryChecklistState }) {
  const gaps = checklistDisplayGaps(state);
  return (
    <ul className="space-y-1.5">
      {gaps.missing.map((gap) => (
        <li key={`missing-${gap}`} className="flex items-center justify-between gap-2 type-body">
          <span className="text-foreground">{gap}</span>
          <Badge variant="outline" className="type-caption shrink-0">
            Open
          </Badge>
        </li>
      ))}
      {gaps.partial.map((gap) => (
        <li key={`partial-${gap}`} className="flex items-center justify-between gap-2 type-body">
          <span className="text-foreground">{gap}</span>
          <Badge variant="secondary" className="type-caption shrink-0">
            Partial
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
  const gapSummary = formatChecklistDisplayGaps(state);

  return (
    <div className={cn("glass-insight-card shadow-none", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="type-label text-muted-foreground">
            Discovery coverage
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CoverageRing percent={bantPct} label="BANT" />
          <Badge variant={bantComplete ? "success" : "secondary"} className="type-caption">
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

        {gapSummary && (
          <p className="type-caption text-muted-foreground">
            {gapSummary}
          </p>
        )}

        <p className="type-caption text-muted-foreground">Overall qualification {allPct}%</p>

        {secondary.length > 0 && (
          <div>
            <button
              type="button"
              className="flex h-7 w-full items-center justify-between rounded-md px-2 type-label hover:bg-muted/40"
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

function ChecklistCoverageProgress({
  percent,
  openGapCount,
}: {
  percent: number;
  openGapCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="type-body font-medium text-muted-foreground">Discovery coverage</span>
        <span className="type-body font-extrabold tabular-nums text-foreground">{percent}%</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        tabIndex={0}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Discovery coverage ${percent} percent`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {openGapCount > 0 ? (
        <p className="type-caption text-muted-foreground">
          {openGapCount} open gap{openGapCount === 1 ? "" : "s"} to confirm on the call
        </p>
      ) : null}
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
        <title>{`${label} coverage`}</title>
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
      <span className="absolute inset-0 flex items-center justify-center type-caption font-medium">
        {percent}
      </span>
    </div>
  );
}
