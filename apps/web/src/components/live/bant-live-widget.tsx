"use client";

import { useMemo, useState } from "react";
import { Target, X } from "lucide-react";
import { BantLiveStatusBars } from "@/components/live/bant-live-status-bars";
import { LiveWidgetAccordionCard } from "@/components/live/live-widget-accordion-card";
import {
  liveColumnHorizontalPadding,
  liveColumnScrollPadding,
} from "@/components/live/live-column-header";
import type { BantSignal } from "@/lib/live-types";
import { formatBudgetSignalLabel, formatBudgetUsd, hasBudgetAmount } from "@/lib/currency-format";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import { cn } from "@/lib/cn";

const BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;
type BantKey = (typeof BANT_KEYS)[number];

const bantLabels: Record<BantKey, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

function bantStatusLabel(status: string, key: BantKey): string {
  if (status === "confirmed") {
    return key === "authority" ? "Identified" : "Confirmed";
  }
  if (status === "partial") return "Partially qualified";
  if (key === "timeline" && status === "unknown") return "Urgent";
  return "Open";
}

function bantStatusClass(status: string, key: BantKey): string {
  if (status === "confirmed") return "text-success";
  if (status === "partial") return "text-foreground";
  if (key === "timeline" && status === "unknown") return "text-destructive";
  return "text-muted-foreground";
}

interface BantLiveWidgetProps {
  checklist: DiscoveryChecklistState | null;
  bantSignals?: BantSignal[];
  className?: string;
}

function bantSignalHeadline(signal: BantSignal): string | null {
  const label =
    signal.dimension === "budget"
      ? formatBudgetSignalLabel(signal.label, signal.value)
      : signal.label;
  const value =
    signal.dimension === "budget" ? formatBudgetUsd(signal.value) : signal.value;
  const shouldAppendValue =
    Boolean(value) && !label.includes(value ?? "") && !hasBudgetAmount(label);

  if (shouldAppendValue) return `${label}: ${value}`;
  if (value?.trim()) return value.trim();
  if (label?.trim()) return label.trim();
  return null;
}

function formatEvidenceValue(dimension: BantKey, value: string): string {
  return dimension === "budget" ? formatBudgetUsd(value) : value;
}

function BantDimensionBlock({
  dimension,
  status,
  detailsOpen,
  evidence,
  signals,
}: {
  dimension: BantKey;
  status: string;
  detailsOpen: boolean;
  evidence?: { value: string; snippet: string; sentiment?: string };
  signals: BantSignal[];
}) {
  const hasDetails =
    Boolean(evidence?.value?.trim() || evidence?.snippet?.trim()) || signals.length > 0;

  return (
    <div className="border-b border-border/50 last:border-b-0" data-bant-dimension={dimension}>
      <div className="flex items-center justify-between gap-3 py-2.5">
        <span
          className={cn(
            "shrink-0 type-label",
            detailsOpen ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          {bantLabels[dimension]}
        </span>
        <span className={cn("truncate type-label", bantStatusClass(status, dimension))}>
          {bantStatusLabel(status, dimension)}
        </span>
      </div>

      {detailsOpen && hasDetails && (
        <div className="space-y-2 pb-2.5 pl-0.5">
          {(() => {
            const value = evidence?.value?.trim() ?? "";
            const snippet = evidence?.snippet?.trim() ?? "";
            const concernPrefix = evidence?.sentiment === "negative" ? "Concern: " : "";

            if (value) {
              return (
                <>
                  <p className="type-caption font-medium leading-snug text-foreground">
                    {concernPrefix}
                    {formatEvidenceValue(dimension, value)}
                  </p>
                  {snippet && snippet !== value && (
                    <p className="type-caption leading-relaxed text-muted-foreground">{snippet}</p>
                  )}
                </>
              );
            }

            if (snippet) {
              return (
                <p className="type-caption font-medium leading-snug text-foreground">
                  {concernPrefix}
                  {snippet}
                </p>
              );
            }

            return null;
          })()}
          {signals.map((signal) => {
            const headline = bantSignalHeadline(signal);
            const snippet = signal.snippet?.trim();
            const showSnippet = Boolean(snippet && snippet !== headline);

            return (
              <div key={signal.id} className="space-y-0.5">
                {headline && (
                  <p className="type-caption font-medium leading-snug text-foreground">{headline}</p>
                )}
                {showSnippet && (
                  <p className="type-caption leading-relaxed text-muted-foreground">{snippet}</p>
                )}
                {!headline && snippet && (
                  <p className="type-caption font-medium leading-snug text-foreground">{snippet}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function useBantDetailData(
  checklist: DiscoveryChecklistState | null,
  bantSignals: BantSignal[]
) {
  const evidenceById = useMemo(() => {
    const checklistItems = Array.isArray(checklist?.items) ? checklist.items : [];
    return Object.fromEntries(
      checklistItems
        .filter((i) => i.tier === "bant")
        .map((i) => {
          const evidence = i.evidence?.[i.evidence.length - 1];
          return [
            i.id,
            {
              value: evidence?.value?.trim() ?? "",
              snippet: evidence?.snippet?.trim() ?? "",
              sentiment: evidence?.sentiment,
            },
          ];
        })
    ) as Record<string, { value: string; snippet: string; sentiment?: string }>;
  }, [checklist]);

  const signalsByDimension = useMemo(() => {
    const grouped: Record<BantKey, BantSignal[]> = {
      budget: [],
      authority: [],
      need: [],
      timeline: [],
    };
    for (const signal of [...bantSignals].reverse().slice(0, 16)) {
      grouped[signal.dimension].push(signal);
    }
    return grouped;
  }, [bantSignals]);

  const hasDetailContent = BANT_KEYS.some(
    (key) =>
      Boolean(evidenceById[key]?.value?.trim() || evidenceById[key]?.snippet?.trim()) ||
      signalsByDimension[key].length > 0
  );

  return { evidenceById, signalsByDimension, hasDetailContent };
}

/** Unified BANT widget — four live items by default; per-dimension detail on demand. */
export function BantLiveWidget({
  checklist,
  bantSignals = [],
  className,
}: BantLiveWidgetProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { evidenceById, signalsByDimension, hasDetailContent } = useBantDetailData(
    checklist,
    bantSignals
  );

  return (
    <LiveWidgetAccordionCard
      icon={Target}
      title="BANT live"
      extra={<BantLiveStatusBars checklist={checklist} />}
      className={className}
      testId="bant-live-section"
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden",
          detailsOpen && "max-h-[min(40vh,320px)] min-h-0"
        )}
      >
          {detailsOpen && hasDetailContent && (
            <div className={cn("flex shrink-0 items-center justify-between gap-2 border-b border-border/50 py-2", liveColumnHorizontalPadding)}>
              <span className="type-kicker text-muted-foreground">
                Details
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 type-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
                data-testid="bant-hide-details"
                aria-label="Hide BANT details"
                onClick={() => setDetailsOpen(false)}
              >
                <X className="h-3 w-3" aria-hidden />
                Hide details
              </button>
            </div>
          )}

          <div
            className={cn(
              liveColumnScrollPadding,
              detailsOpen &&
                "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
            )}
          >
            {!checklist ? (
              <p className="py-2 type-caption text-muted-foreground">
                BANT signals will appear as the conversation progresses.
              </p>
            ) : (
              <div className="flex min-w-0 flex-col">
                <div data-testid={detailsOpen ? "bant-signals-section" : undefined}>
                  {BANT_KEYS.map((key) => (
                    <BantDimensionBlock
                      key={key}
                      dimension={key}
                      status={checklist.bant[key] ?? "unknown"}
                      detailsOpen={detailsOpen}
                      evidence={evidenceById[key]}
                      signals={signalsByDimension[key]}
                    />
                  ))}
                </div>

                {hasDetailContent && !detailsOpen && (
                  <button
                    type="button"
                    className="mt-2 text-left type-caption font-medium text-primary hover:underline"
                    data-testid="bant-see-details"
                    aria-expanded={false}
                    onClick={() => setDetailsOpen(true)}
                  >
                    See details
                  </button>
                )}
              </div>
            )}
          </div>
      </div>
    </LiveWidgetAccordionCard>
  );
}
