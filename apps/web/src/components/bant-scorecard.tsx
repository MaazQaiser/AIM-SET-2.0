import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BANTScore, BANTStatus } from "@/types";

const statusConfig: Record<BANTStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  confirmed: {
    icon: CheckCircle2,
    color: "text-success",
    label: "Confirmed",
  },
  partial: {
    icon: Circle,
    color: "text-warning",
    label: "Partial",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground",
    label: "Unknown",
  },
};

const bantLabels = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

type BANTLayout = "inline" | "stack" | "grid" | "row";

interface BANTScorecardProps {
  bant: BANTScore;
  /** @deprecated use `layout="inline"` instead */
  compact?: boolean;
  layout?: BANTLayout;
}

export function BANTScorecard({ bant, compact = false, layout }: BANTScorecardProps) {
  const resolvedLayout: BANTLayout = layout ?? (compact ? "inline" : "grid");
  const keys = ["budget", "authority", "need", "timeline"] as const;

  if (resolvedLayout === "inline") {
    return (
      <div className="flex items-center gap-1">
        {keys.map((key) => {
          const status = bant[key];
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <span
              key={key}
              className={cn("flex items-center gap-0.5 text-xs font-medium", config.color)}
              title={`${bantLabels[key]}: ${config.label}`}
            >
              <Icon className="h-3 w-3" />
              <span className="uppercase">{key[0]}</span>
            </span>
          );
        })}
      </div>
    );
  }

  const gridClass =
    resolvedLayout === "stack"
      ? "grid grid-cols-1 gap-2"
      : resolvedLayout === "row"
        ? "grid grid-cols-4 gap-2"
        : "grid grid-cols-2 gap-3";

  return (
    <div className={gridClass}>
      {keys.map((key) => {
        const status = bant[key];
        const config = statusConfig[status];
        const Icon = config.icon;
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 min-w-0"
          >
            <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                {bantLabels[key]}
              </p>
              <p className={cn("text-sm font-semibold truncate", config.color)}>{config.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
