"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  HelpCircle,
  Lightbulb,
  ScanEye,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { AiGradientText } from "@/components/ai-gradient-text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import {
  buildRunningSummaryLines,
  type RunningSummaryInput,
} from "@/lib/live/build-running-summary-lines";
import type { LiveInsightKind, LiveInsightLine } from "@/lib/live/build-copilot-insights";
import { dedupePainSignals, painQuote, painSummary } from "@/lib/live/pain-display";
import type { PainSignal } from "@/types";

const SUMMARY_PREVIEW_MAX = 280;
const PAIN_LIMIT = 6;
const INSIGHT_PREVIEW_MAX = 72;

const rowActionButtonClass =
  "shrink-0 text-xs text-muted-foreground transition-all group-hover:rounded-md group-hover:bg-foreground group-hover:px-2 group-hover:py-0.5 group-hover:text-background";

const rowDismissButtonClass =
  "shrink-0 rounded p-0.5 text-muted-foreground opacity-70 transition-all group-hover:bg-foreground group-hover:text-background group-hover:opacity-100";

interface LiveCopilotSummaryProps extends RunningSummaryInput {
  pains: PainSignal[];
  insights: LiveInsightLine[];
  className?: string;
}

const insightKindMeta: Record<
  LiveInsightKind,
  { icon: LucideIcon; accent: string; chipClass: string; label: string; tooltip: string }
> = {
  insight: {
    icon: Lightbulb,
    accent: "text-blue-500",
    chipClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "Signal",
    tooltip: "Live signal",
  },
  question: {
    icon: HelpCircle,
    accent: "text-primary",
    chipClass: "bg-primary/10 text-primary",
    label: "Question",
    tooltip: "Discovery question",
  },
  alert: {
    icon: AlertTriangle,
    accent: "text-destructive",
    chipClass: "bg-destructive/10 text-destructive",
    label: "Alert",
    tooltip: "Objection or risk alert",
  },
};

function InsightKindChip({
  kind,
  className,
}: {
  kind: LiveInsightKind;
  className?: string;
}) {
  const meta = insightKindMeta[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        meta.chipClass,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

function SectionHeading({
  children,
  icon: Icon,
  tone = "default",
}: {
  children: string;
  icon: LucideIcon;
  tone?: "default" | "orange" | "blue";
}) {
  if (tone === "orange") {
    return (
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">
          {children}
        </p>
      </div>
    );
  }

  if (tone === "blue") {
    return (
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
          {children}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <AiGradientText as="p" className="text-[10px] font-semibold uppercase tracking-wide">
        {children}
      </AiGradientText>
    </div>
  );
}

function InlineExpandToggle({
  expanded,
  onToggle,
  expandLabel = "See more",
  collapseLabel = "Show less",
}: {
  expanded: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  return (
    <>
      {" "}
      <button
        type="button"
        className="inline text-xs text-primary underline-offset-2 hover:underline"
        onClick={onToggle}
      >
        {expanded ? collapseLabel : expandLabel}
      </button>
    </>
  );
}

function previewText(text: string, max = INSIGHT_PREVIEW_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function PainPointRow({
  pain,
  expanded,
  onToggleExpand,
}: {
  pain: PainSignal;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const summary = painSummary(pain);
  const quote = painQuote(pain);
  const hasDetails = Boolean(quote) || summary.length > INSIGHT_PREVIEW_MAX;
  const lineText = previewText(summary);

  return (
    <div className="border-b border-border/40 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="mt-0.5 inline-flex shrink-0 rounded-full p-0.5"
              tabIndex={0}
              aria-label="Pain point"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">Pain point</TooltipContent>
        </Tooltip>

        <p className="min-w-0 flex-1 truncate text-sm text-foreground" title={summary}>
          {lineText}
        </p>

        {hasDetails && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show details"}
            onClick={onToggleExpand}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="mt-1.5 space-y-1 pl-3.5 text-xs leading-relaxed text-muted-foreground">
          {summary.length > INSIGHT_PREVIEW_MAX && (
            <p className="text-foreground/80">{summary}</p>
          )}
          {quote && <p>&ldquo;{quote}&rdquo;</p>}
        </div>
      )}
    </div>
  );
}

function RunningSummarySection({
  accountName,
  leadName,
  intent,
  intentLabel,
  checklist,
  transcript,
}: RunningSummaryInput) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(
    () =>
      buildRunningSummaryLines({
        accountName,
        leadName,
        intent,
        intentLabel,
        checklist,
        transcript,
      }),
    [accountName, leadName, intent, intentLabel, checklist, transcript]
  );
  const fullSummary = lines.join(" ");
  const isTruncated = fullSummary.length > SUMMARY_PREVIEW_MAX;
  const displaySummary =
    expanded || !isTruncated ? fullSummary : previewText(fullSummary, SUMMARY_PREVIEW_MAX);

  if (lines.length === 0) {
    return (
      <section data-testid="running-summary">
        <SectionHeading icon={FileText}>Running Summary</SectionHeading>
        <p className="text-sm text-muted-foreground">Summary will build as the call progresses.</p>
      </section>
    );
  }

  return (
    <section data-testid="running-summary">
      <SectionHeading icon={FileText}>Running Summary</SectionHeading>
      <p className="text-sm leading-relaxed text-foreground break-words">
        {displaySummary}
        {isTruncated && (
          <InlineExpandToggle
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
          />
        )}
      </p>
    </section>
  );
}

function PainPointsSection({ pains }: { pains: PainSignal[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const visiblePains = useMemo(
    () => dedupePainSignals(pains).slice(-PAIN_LIMIT),
    [pains]
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="mt-4 border-t border-border/50 pt-4" data-testid="pain-points">
      <SectionHeading icon={Target} tone="orange">
        Pain Points Identified
      </SectionHeading>
      {visiblePains.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pain points appear as the customer speaks.</p>
      ) : (
        <div>
          {visiblePains.map((pain) => (
            <PainPointRow
              key={pain.id}
              pain={pain}
              expanded={expandedIds.has(pain.id)}
              onToggleExpand={() => toggleExpand(pain.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LiveInsightRow({
  item,
  expanded,
  onToggleExpand,
  onDismiss,
  onRestore,
  dimmed = false,
}: {
  item: LiveInsightLine;
  expanded: boolean;
  onToggleExpand: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
  dimmed?: boolean;
}) {
  const meta = insightKindMeta[item.kind];
  const { icon: Icon, accent, tooltip } = meta;
  const details = item.details ?? [];
  const hasDetails = details.length > 0 || item.message.length > INSIGHT_PREVIEW_MAX;
  const lineText = previewText(item.message);

  return (
    <div
      className={cn(
        "group border-b border-border/40 py-2 last:border-b-0",
        dimmed && "opacity-60"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 rounded p-0.5" tabIndex={0}>
              <Icon className={cn("h-3.5 w-3.5", accent)} aria-hidden />
              <span className="sr-only">{tooltip}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>

        <InsightKindChip kind={item.kind} />

        <p className="min-w-0 flex-1 truncate text-sm text-foreground" title={item.message}>
          <span className="sr-only">{item.label}: </span>
          {lineText}
        </p>

        {hasDetails && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show details"}
            onClick={onToggleExpand}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}

        {item.onGotIt && !onRestore && (
          <button
            type="button"
            className={rowActionButtonClass}
            onClick={item.onGotIt}
          >
            {item.gotItLabel ?? "Got it"}
          </button>
        )}

        {onRestore && (
          <button type="button" className={rowActionButtonClass} onClick={onRestore}>
            Restore
          </button>
        )}

        {item.onDismiss && onDismiss && (
          <button
            type="button"
            className={rowDismissButtonClass}
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="mt-1.5 space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          {item.message.length > INSIGHT_PREVIEW_MAX && (
            <p className="text-foreground/80">{item.message}</p>
          )}
          {details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveInsightsSection({ insights }: { insights: LiveInsightLine[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const activeInsights = insights.filter((item) => !dismissedIds.has(item.id));
  const dismissedInsights = insights.filter((item) => dismissedIds.has(item.id));

  const dismiss = (item: LiveInsightLine) => {
    item.onDismiss?.();
    setDismissedIds((prev) => new Set(prev).add(item.id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const restore = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const restoreAll = () => {
    setDismissedIds(new Set());
    setShowDismissed(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="mt-4 border-t border-border/50 pt-4" data-testid="live-insights">
      <SectionHeading icon={ScanEye} tone="blue">
        Live Insights
      </SectionHeading>
      {activeInsights.length === 0 && dismissedInsights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          AI insights will appear here as the call progresses.
        </p>
      ) : (
        <>
          {activeInsights.length === 0 && dismissedInsights.length > 0 && (
            <p className="mb-2 text-sm text-muted-foreground">All insights are dismissed.</p>
          )}
          <div>
            {activeInsights.map((item) => (
              <LiveInsightRow
                key={item.id}
                item={item}
                expanded={expandedIds.has(item.id)}
                onToggleExpand={() => toggleExpand(item.id)}
                onDismiss={() => dismiss(item)}
              />
            ))}
          </div>
          {dismissedInsights.length > 0 && (
            <div className="mt-2 border-t border-border/40 pt-2">
              {!showDismissed ? (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => setShowDismissed(true)}
                >
                  Show {dismissedInsights.length} dismissed insight
                  {dismissedInsights.length === 1 ? "" : "s"}
                </button>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dismissed
                    </p>
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      onClick={restoreAll}
                    >
                      Restore all
                    </button>
                  </div>
                  {dismissedInsights.map((item) => (
                    <LiveInsightRow
                      key={item.id}
                      item={item}
                      dimmed
                      expanded={expandedIds.has(item.id)}
                      onToggleExpand={() => toggleExpand(item.id)}
                      onRestore={() => restore(item.id)}
                    />
                  ))}
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setShowDismissed(false)}
                  >
                    Hide dismissed
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function LiveCopilotSummary({
  accountName,
  leadName,
  intent,
  intentLabel,
  checklist,
  transcript,
  pains,
  insights,
  className,
}: LiveCopilotSummaryProps) {
  const summaryInput = useMemo(
    () => ({
      accountName,
      leadName,
      intent,
      intentLabel,
      checklist,
      transcript,
    }),
    [accountName, leadName, intent, intentLabel, checklist, transcript]
  );

  return (
    <div className={cn("min-w-0 shrink-0", className)} data-testid="live-copilot-summary">
      <RunningSummarySection {...summaryInput} />
      <PainPointsSection pains={pains} />
      <LiveInsightsSection insights={insights} />
    </div>
  );
}
