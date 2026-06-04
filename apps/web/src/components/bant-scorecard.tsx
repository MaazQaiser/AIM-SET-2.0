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

type BANTLayout = "inline" | "stack" | "grid" | "row" | "strip";

interface BANTScorecardProps {
  bant: BANTScore;
  /** Latest transcript snippet per dimension (from live checklist) */
  evidenceByDimension?: Partial<Record<keyof BANTScore, string>>;
  /** @deprecated use `layout="inline"` instead */
  compact?: boolean;
  layout?: BANTLayout;
  /** No per-dimension boxes — use inside an outer brief card */
  plain?: boolean;
  /** Tighter gaps for header strip row layout */
  dense?: boolean;
  /** Slightly larger strip for header / nav bars */
  stripScale?: "sm" | "md";
}

export function BANTScorecard({
  bant,
  evidenceByDimension,
  compact = false,
  layout,
  plain = false,
  dense = false,
  stripScale = "sm",
}: BANTScorecardProps) {
  const resolvedLayout: BANTLayout = layout ?? (compact ? "inline" : "grid");
  const keys = ["budget", "authority", "need", "timeline"] as const;

  if (resolvedLayout === "strip") {
    const md = stripScale === "md";
    return (
      <div
        className={cn(
          "grid grid-cols-4 text-left",
          md ? "gap-x-3 sm:gap-x-4" : "gap-x-3 sm:gap-x-4"
        )}
      >
        {keys.map((key) => {
          const status = bant[key] ?? "unknown";
          const config = statusConfig[status] ?? statusConfig.unknown;
          const Icon = config.icon;
          return (
            <div
              key={key}
              className={cn("flex items-center min-w-0 text-left", md ? "gap-2.5" : "gap-2")}
            >
              <Icon
                className={cn("shrink-0", md ? "h-4 w-4" : "h-3.5 w-3.5", config.color)}
              />
              <div className="min-w-0 leading-none text-left">
                <p className="text-left text-xs font-medium text-muted-foreground">
                  {bantLabels[key]}
                </p>
                <p
                  className={cn(
                    "text-left font-bold",
                    md ? "text-xs" : "text-[11px]",
                    config.color
                  )}
                >
                  {config.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (resolvedLayout === "inline") {
    return (
      <div className="flex items-center gap-1">
        {keys.map((key) => {
          const status = bant[key] ?? "unknown";
          const config = statusConfig[status] ?? statusConfig.unknown;
          const Icon = config.icon;
          return (
            <span
              key={key}
              className={cn("flex items-center gap-0.5 text-xs font-medium", config.color)}
              title={`${bantLabels[key]}: ${config.label}`}
            >
              <Icon className="h-3 w-3" />
              <span>{key[0]}</span>
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
        ? cn("grid grid-cols-4", dense ? "gap-1" : "gap-2")
        : "grid grid-cols-2 gap-3";

  return (
    <div className={gridClass}>
      {keys.map((key) => {
        const status = bant[key] ?? "unknown";
        const config = statusConfig[status] ?? statusConfig.unknown;
        const Icon = config.icon;
        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-2 min-w-0",
              plain ? "py-1" : "rounded-lg border border-border bg-muted/40 p-2.5"
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
            <div className="min-w-0 text-left">
              <p className="text-left text-xs font-medium text-muted-foreground truncate">
                {bantLabels[key]}
              </p>
              <p className={cn("text-left text-xs font-semibold truncate", config.color)}>
                {config.label}
              </p>
              {evidenceByDimension?.[key] && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  &ldquo;{evidenceByDimension[key]}&rdquo;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
