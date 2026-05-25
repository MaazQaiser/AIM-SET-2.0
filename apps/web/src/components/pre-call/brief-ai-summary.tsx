"use client";

import { Sparkles, TrendingUp, Calendar, DollarSign, Target, Users } from "lucide-react";
import { WorkflowAgentBadge } from "@/components/pre-call/workflow-agent-badge";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { parseSummaryHighlights, type SummaryHighlightRule } from "@/lib/brief-summary-highlights";
import { useAgentConfig } from "@/lib/data/agent-config-hooks";
import type { CallBrief } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface BriefAISummaryProps {
  brief: CallBrief;
}

const STAGE_COLOR: Record<string, string> = {
  "Evaluation → Proposal": "bg-blue-100/90 text-blue-800 border-blue-200/80",
  Discovery: "bg-purple-100/90 text-purple-800 border-purple-200/80",
  Proposal: "bg-orange-100/90 text-orange-800 border-orange-200/80",
  "Closed Won": "bg-emerald-100/90 text-emerald-800 border-emerald-200/80",
  "Closed Lost": "bg-rose-100/90 text-rose-800 border-rose-200/80",
};

function MetaChip({
  children,
  className,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium min-w-0 max-w-full",
        className
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function HighlightedSummary({
  text,
  clamp,
  rules,
}: {
  text: string;
  clamp?: boolean;
  rules?: SummaryHighlightRule[];
}) {
  const parts = parseSummaryHighlights(text, rules);
  let offset = 0;
  const keyedParts = parts.map((part) => {
    const key = `${offset}-${part.value}`;
    offset += part.value.length;
    return { ...part, key };
  });

  return (
    <p
      className={cn(
        "text-sm leading-relaxed text-foreground/90 break-words",
        clamp && "line-clamp-6"
      )}
    >
      {keyedParts.map((part) =>
        part.type === "highlight" ? (
          <mark key={part.key} className={cn(part.className, "font-medium")}>
            {part.value}
          </mark>
        ) : (
          <span key={part.key}>{part.value}</span>
        )
      )}
    </p>
  );
}

export function BriefAISummary({ brief }: BriefAISummaryProps) {
  const { data: workflowConfig } = useAgentConfig("workflow");
  const highlightRules = workflowConfig?.summary_highlight_rules;

  const { compact, columnZone } = useWidgetSize();
  const isCenter = columnZone === "center";
  const stageClass = STAGE_COLOR[brief.dealStage] ?? "bg-muted/60 text-muted-foreground border-border";
  const contactUrgency = brief.daysSinceLastContact > 14 ? "text-warning" : "text-muted-foreground";
  const icpPct = Math.round(brief.icpMatch * 100);
  const icpSegments = brief.icpNote?.split("·").map((s) => s.trim()).filter(Boolean) ?? [];

  return (
    <BriefDetailCard
      title="PRE-DC Workflow summary"
      icon={Sparkles}
      variant="highlight"
      sourceInfo={{
        source: "AI from Pre-DC lead data",
        detail:
          "The workflow summarizes only the imported lead research: company stage, ICP fit, described need, timing, and Tkxel fit. It is instructed not to invent facts.",
      }}
      headerExtra={<WorkflowAgentBadge />}
    >
      <div className="space-y-4 min-w-0">
        {/* Deal context + ICP / firmographic chips (top) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {brief.opportunityValue && (
            <MetaChip
              className="bg-amber-50/90 border-amber-200/70 text-amber-950"
              icon={<DollarSign className="h-3 w-3 shrink-0 text-amber-700" />}
            >
              {brief.opportunityValue}
            </MetaChip>
          )}
          <MetaChip className={cn("border", stageClass)} icon={<Target className="h-3 w-3 shrink-0" />}>
            {brief.dealStage}
          </MetaChip>
          <MetaChip
            className="bg-violet-50/90 border-violet-200/70 text-violet-950"
            icon={<TrendingUp className="h-3 w-3 shrink-0 text-violet-700" />}
          >
            ICP {icpPct}%
          </MetaChip>
          {icpSegments.map((segment) => (
            <MetaChip
              key={segment}
              className="bg-slate-100/90 border-slate-200/70 text-slate-800"
              icon={<Users className="h-3 w-3 shrink-0 text-slate-600" />}
            >
              {segment}
            </MetaChip>
          ))}
          {(!compact || isCenter) && (
            <MetaChip
              className={cn(
                "bg-background/80 border-border",
                contactUrgency === "text-warning" && "bg-warning/10 border-warning/30 text-warning"
              )}
              icon={<Calendar className="h-3 w-3 shrink-0" />}
            >
              Last contact {brief.daysSinceLastContact}d ago
            </MetaChip>
          )}
        </div>

        <HighlightedSummary
          text={brief.aiSummary ?? ""}
          clamp={!isCenter && compact}
          rules={highlightRules}
        />
      </div>
    </BriefDetailCard>
  );
}
