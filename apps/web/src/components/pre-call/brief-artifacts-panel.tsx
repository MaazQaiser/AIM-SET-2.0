"use client";

import { FileCheck, FileQuestion, FileSearch, Package } from "lucide-react";
import { WorkflowAgentBadge } from "@/components/pre-call/workflow-agent-badge";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { Badge } from "@/components/ui/badge";
import type { CallBrief } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface BriefArtifactsPanelProps {
  brief: CallBrief;
}

const STATUS_STYLE: Record<string, string> = {
  found: "bg-emerald-100/90 text-emerald-900 border-emerald-200/80",
  partial: "bg-amber-100/90 text-amber-950 border-amber-200/80",
  missing: "bg-rose-100/90 text-rose-950 border-rose-200/80",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "found") return <FileCheck className="h-3.5 w-3.5 text-emerald-700" />;
  if (status === "partial") return <FileSearch className="h-3.5 w-3.5 text-amber-700" />;
  return <FileQuestion className="h-3.5 w-3.5 text-rose-700" />;
}

export function BriefArtifactsPanel({ brief }: BriefArtifactsPanelProps) {
  const plan = brief.artifactPlan ?? [];
  const fulfillment = brief.artifactFulfillment ?? [];

  if (plan.length === 0 && fulfillment.length === 0) {
    return null;
  }

  const fulfillmentById = new Map(fulfillment.map((f) => [f.artifactId, f]));

  return (
    <BriefDetailCard
      title="PRE-DC Workflow artifacts"
      icon={Package}
      headerExtra={<WorkflowAgentBadge />}
    >
      <div className="space-y-4 min-w-0">
        {brief.agentStatus === "failed" && (
          <p className="text-xs text-warning rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
            PRE-DC Workflow could not complete artifact planning. Re-import the lead or re-run from
            Agents → PRE-DC Workflow.
          </p>
        )}

        {plan.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Planned for this call
            </p>
            <ol className="space-y-2 list-decimal list-inside">
              {plan
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground text-xs ml-1">({item.type})</span>
                    {item.rationale ? (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">{item.rationale}</p>
                    ) : null}
                  </li>
                ))}
            </ol>
          </div>
        )}

        {fulfillment.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              KB fulfillment
            </p>
            <ul className="space-y-3">
              {fulfillment.map((row) => {
                const planned = fulfillmentById.has(row.artifactId)
                  ? plan.find((p) => p.id === row.artifactId)
                  : null;
                const label = row.name || planned?.name || row.artifactId;
                return (
                  <li
                    key={row.artifactId}
                    className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIcon status={row.status} />
                      <span className="text-sm font-medium">{label}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] capitalize", STATUS_STYLE[row.status])}
                      >
                        {row.status}
                      </Badge>
                    </div>
                    {row.snippet ? (
                      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-2">
                        {row.snippet}
                      </p>
                    ) : null}
                    {row.requiredData ? (
                      <p className="text-xs text-rose-800/90 dark:text-rose-200/90">
                        <span className="font-medium">Needed: </span>
                        {row.requiredData}
                      </p>
                    ) : null}
                    {row.assetId ? (
                      <p className="text-[10px] font-mono text-muted-foreground">KB: {row.assetId}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </BriefDetailCard>
  );
}
