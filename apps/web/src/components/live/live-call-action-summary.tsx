"use client";

import { useMemo } from "react";
import { LiveCollapsibleSection } from "@/components/live/live-collapsible-section";
import { Badge } from "@/components/ui/badge";
import { scoreEmoji, scoreToTone } from "@/lib/live/sentiment-display";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { CallIntent, PainSignal, SentimentShift } from "@/types";
import { cn } from "@/lib/cn";

interface LiveCallActionSummaryProps {
  intentLabel?: string;
  intent?: CallIntent | null;
  pains: PainSignal[];
  sentimentAE: number;
  sentimentCustomer: number;
  sentimentShift: SentimentShift | null;
  checklist: DiscoveryChecklistState | null;
  className?: string;
}

function MetricTile({
  label,
  value,
  hint,
  variant = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  variant?: "default" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 min-w-0",
        variant === "good" && "border-success/30 bg-success/5",
        variant === "warn" && "border-amber-200/70 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20",
        variant === "default" && "border-border bg-card/50"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground mt-0.5 truncate">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{hint}</p>}
    </div>
  );
}

export function LiveCallActionSummary({
  intentLabel,
  intent,
  pains,
  sentimentAE,
  sentimentCustomer,
  sentimentShift,
  checklist,
  className,
}: LiveCallActionSummaryProps) {
  const bantPct = checklist ? Math.round(checklist.bantCoverage * 100) : null;
  const openGaps = checklist?.openGaps ?? [];
  const intentDisplay = (intent?.label ?? intentLabel ?? "detecting…").replace(/_/g, " ");

  const actions = useMemo(() => {
    const items: string[] = [];
    const latestPain = pains.length > 0 ? pains[pains.length - 1]?.text?.slice(0, 60) : "";
    const bantItems = checklist?.items?.filter((i) => i.tier === "bant") ?? [];
    const confirmedBant = bantItems.filter((i) => i.status === "confirmed").map((i) => i.label);
    const partialBant = bantItems.filter((i) => i.status === "partial").map((i) => i.label);

    if (openGaps.includes("authority")) {
      const evidence = bantItems.find((i) => i.id === "authority")?.evidence?.[0]?.snippet;
      items.push(
        evidence
          ? `Probe authority deeper — customer mentioned: "${evidence.slice(0, 50)}…"`
          : "Identify the decision maker — ask who else needs to approve."
      );
    }
    if (openGaps.includes("budget")) {
      const evidence = bantItems.find((i) => i.id === "budget")?.evidence?.[0]?.snippet;
      items.push(
        evidence
          ? `Clarify budget — customer said: "${evidence.slice(0, 50)}…"`
          : "Ask about budget range and approval process."
      );
    }
    if (openGaps.includes("need") && pains.length > 0) {
      items.push(`Dig into pain point: "${latestPain}…" — quantify impact and urgency.`);
    } else if (openGaps.includes("need")) {
      items.push("Uncover core need — ask what problem is most urgent right now.");
    }
    if (openGaps.includes("timeline")) {
      const evidence = bantItems.find((i) => i.id === "timeline")?.evidence?.[0]?.snippet;
      items.push(
        evidence
          ? `Pin down timeline — customer mentioned: "${evidence.slice(0, 50)}…"`
          : "Ask about target go-live date or decision deadline."
      );
    }
    if (sentimentShift?.direction === "negative") {
      items.push(sentimentShift.message || "Address sentiment shift — re-engage on outcomes.");
    }
    if (pains.length >= 2 && bantPct != null && bantPct >= 70) {
      items.push("Strong discovery — propose next steps: pilot scope, timeline, or proposal outline.");
    }
    if (confirmedBant.length > 0 && items.length < 3) {
      items.push(`${confirmedBant.join(", ")} confirmed — focus on remaining gaps.`);
    }
    if (partialBant.length > 0 && items.length < 4) {
      items.push(`Deepen partial signals: ${partialBant.join(", ")} — ask for specifics.`);
    }
    if (items.length === 0) {
      items.push("Continue discovery — ask open-ended questions to uncover pain and BANT.");
    }
    return items.slice(0, 4);
  }, [openGaps, sentimentShift, pains, bantPct, checklist]);

  const hasLiveSignals =
    intent ||
    intentLabel ||
    pains.length > 0 ||
    bantPct != null ||
    sentimentAE !== 0 ||
    sentimentCustomer !== 0;

  if (!hasLiveSignals) return null;

  const summaryParts = [
    `${scoreEmoji(sentimentAE)} AE`,
    `${scoreEmoji(sentimentCustomer)} Customer`,
    intentDisplay,
    bantPct != null ? `${bantPct}% BANT` : null,
  ].filter(Boolean);

  return (
    <div className={cn("mb-3", className)}>
      <LiveCollapsibleSection
        title="Actionable snapshot"
        summary={summaryParts.join(" · ")}
        defaultOpen
      >
        <div className="grid grid-cols-2 gap-2 pt-2">
          <MetricTile
            label="Call intent"
            value={intentDisplay}
            hint={intent?.evidence ? `“${intent.evidence.slice(0, 80)}…”` : undefined}
            variant="good"
          />
          <MetricTile
            label="Discovery (BANT)"
            value={bantPct != null ? `${bantPct}% covered` : "—"}
            hint={
              openGaps.length > 0
                ? `Open: ${openGaps.map((g) => g.replace(/_/g, " ")).join(", ")}`
                : "BANT complete"
            }
            variant={bantPct != null && bantPct >= 75 ? "good" : "warn"}
          />
          <MetricTile
            label="Customer sentiment"
            value={`${scoreEmoji(sentimentCustomer)} ${scoreToTone(sentimentCustomer)}`}
            hint={
              sentimentShift
                ? `${sentimentShift.direction === "negative" ? "📉" : "📈"} Shift detected`
                : "No shift alert"
            }
            variant={scoreToTone(sentimentCustomer) === "negative" ? "warn" : "default"}
          />
          <MetricTile
            label="Pain signals"
            value={pains.length > 0 ? `${pains.length} detected` : "Listening…"}
            hint={
              pains.length > 0
                ? pains[pains.length - 1]?.text?.slice(0, 72)
                : "Pain points surface as the customer speaks"
            }
          />
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Recommended actions
          </p>
          <ul className="space-y-1.5">
            {actions.map((action) => (
              <li
                key={action}
                className="text-xs text-foreground rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 leading-snug"
              >
                {action}
              </li>
            ))}
          </ul>
        </div>
        {pains.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {pains.slice(-3).map((p) => (
              <Badge key={p.id} variant="outline" className="text-[9px] font-normal max-w-full truncate">
                {p.text.slice(0, 48)}
                {p.text.length > 48 ? "…" : ""}
              </Badge>
            ))}
          </div>
        )}
      </LiveCollapsibleSection>
    </div>
  );
}
