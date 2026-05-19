"use client";

import { Sparkles, TrendingUp, Calendar, DollarSign, Target } from "lucide-react";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { Badge } from "@/components/ui/badge";
import type { CallBrief } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

interface BriefAISummaryProps {
  brief: CallBrief;
}

const STAGE_COLOR: Record<string, string> = {
  "Evaluation → Proposal": "bg-blue-100 text-blue-700 border-blue-200",
  "Discovery":              "bg-purple-100 text-purple-700 border-purple-200",
  "Proposal":               "bg-orange-100 text-orange-700 border-orange-200",
  "Closed Won":             "bg-green-100 text-green-700 border-green-200",
  "Closed Lost":            "bg-red-100 text-red-700 border-red-200",
};

export function BriefAISummary({ brief }: BriefAISummaryProps) {
  const stageClass = STAGE_COLOR[brief.dealStage] ?? "bg-muted text-muted-foreground";
  const contactUrgency = brief.daysSinceLastContact > 14 ? "text-warning" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/30 p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Brief Summary</span>
          <AIGeneratedBadge />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {brief.opportunityValue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background border px-2.5 py-0.5 text-xs font-semibold">
              <DollarSign className="h-3 w-3 text-success" />
              {brief.opportunityValue}
            </span>
          )}
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", stageClass)}>
            <Target className="h-3 w-3" />
            {brief.dealStage}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-full bg-background border px-2.5 py-0.5 text-xs", contactUrgency)}>
            <Calendar className="h-3 w-3" />
            Last contact {brief.daysSinceLastContact}d ago
          </span>
        </div>
      </div>

      {/* Summary text */}
      <p className="text-sm leading-relaxed text-foreground/90">
        {brief.aiSummary}
      </p>

      {/* ICP match + note */}
      <div className="flex items-center gap-3 pt-1 border-t border-primary/10">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">ICP match</span>
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 rounded-full bg-primary/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${brief.icpMatch * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-primary">{(brief.icpMatch * 100).toFixed(0)}%</span>
          </div>
        </div>
        {brief.icpNote && (
          <p className="text-xs text-muted-foreground border-l pl-3">{brief.icpNote}</p>
        )}
      </div>
    </div>
  );
}
