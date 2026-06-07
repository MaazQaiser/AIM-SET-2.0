import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { briefMainNestedSurfaceClass } from "@/components/pre-call/brief-detail-card";
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

type BANTLayout = "inline" | "stack" | "grid" | "row" | "split" | "strip";

interface BANTScorecardProps {
  bant: BANTScore;
  /** Latest transcript snippet per dimension (from live checklist) */
  evidenceByDimension?: Partial<Record<keyof BANTScore, string>>;
  /** One or more need statements — shown below B/A/T when using split layout */
  needItems?: string[];
  /** @deprecated use `layout="inline"` instead */
  compact?: boolean;
  layout?: BANTLayout;
  /** No per-dimension boxes — use inside an outer brief card */
  plain?: boolean;
  /** Tighter gaps for header strip row layout */
  dense?: boolean;
  /** Show full evidence text (expand modal) */
  expanded?: boolean;
  /** Slightly larger strip for header / nav bars */
  stripScale?: "sm" | "md";
}

export function BANTScorecard({
  bant,
  evidenceByDimension,
  needItems,
  compact = false,
  layout,
  plain = false,
  dense = false,
  expanded = false,
  stripScale = "sm",
}: BANTScorecardProps) {
  const resolvedLayout: BANTLayout = layout ?? (compact ? "inline" : "grid");
  const keys = ["budget", "authority", "need", "timeline"] as const;
  const topKeys = ["budget", "authority", "timeline"] as const;

  function renderDimension(
    key: (typeof keys)[number],
    options?: { fullWidth?: boolean }
  ) {
    const status = bant[key] ?? "unknown";
    const config = statusConfig[status] ?? statusConfig.unknown;
    const Icon = config.icon;
    const evidence = evidenceByDimension?.[key];

    return (
      <div
        key={key}
        className={cn(
          "flex items-start gap-2 min-w-0",
          options?.fullWidth && "w-full",
          plain
            ? expanded
              ? "py-2"
              : "py-0.5"
            : cn(
                "rounded-lg border border-border bg-muted/40",
                briefMainNestedSurfaceClass,
                expanded ? "p-3.5" : "p-2"
              )
        )}
      >
        <Icon className={cn("shrink-0", expanded ? "h-5 w-5 mt-0.5" : "h-4 w-4", config.color)} />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-left type-label text-muted-foreground">
            {bantLabels[key]}
          </p>
          <p className={cn("text-left font-semibold", expanded ? "type-body" : "type-label", config.color)}>
            {config.label}
          </p>
          {evidence && key !== "need" ? (
            <p
              className={cn(
                "text-muted-foreground mt-1 leading-relaxed",
                expanded ? "type-body" : "type-caption line-clamp-2"
              )}
            >
              &ldquo;{evidence}&rdquo;
            </p>
          ) : expanded && key !== "need" ? (
            <p className="type-caption text-muted-foreground/70 mt-1 italic">No transcript evidence captured.</p>
          ) : null}
        </div>
      </div>
    );
  }

  const resolvedNeedItems =
    needItems ??
    (evidenceByDimension?.need ? splitNeedText(evidenceByDimension.need) : []);

  if (resolvedLayout === "split") {
    const needStatus = bant.need ?? "unknown";
    const needConfig = statusConfig[needStatus] ?? statusConfig.unknown;
    const NeedIcon = needConfig.icon;

    return (
      <div className={cn("space-y-3", expanded ? "gap-4" : "gap-2.5")}>
        <div className={cn("grid grid-cols-3", dense ? "gap-1.5" : "gap-2")}>
          {topKeys.map((key) => renderDimension(key))}
        </div>

        <div
          className={cn(
            "border-t border-border/50 pt-2.5",
            !plain && "rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2",
            plain && "pt-2"
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <NeedIcon className={cn("h-4 w-4 shrink-0", needConfig.color)} />
            <p className="type-label text-muted-foreground">Need</p>
            <span className={cn("type-label", needConfig.color)}>{needConfig.label}</span>
          </div>
          {resolvedNeedItems.length > 0 ? (
            <ul className={cn("space-y-1.5", resolvedNeedItems.length > 1 && "list-none")}>
              {resolvedNeedItems.map((item) => (
                <li
                  key={item}
                  className={cn(
                    "text-muted-foreground leading-relaxed break-words",
                    expanded ? "type-body" : "type-label",
                    resolvedNeedItems.length > 1 &&
                      "relative pl-3 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground/50"
                  )}
                >
                  {resolvedNeedItems.length === 1 ? `"${item}"` : item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-caption text-muted-foreground/70 italic">No need captured.</p>
          )}
        </div>
      </div>
    );
  }

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
                <p className="text-left type-label text-muted-foreground">
                  {bantLabels[key]}
                </p>
                <p
                  className={cn(
                    "text-left font-bold",
                    md ? "type-label" : "type-caption",
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
              className={cn("flex items-center gap-0.5 type-label", config.color)}
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
      ? cn("grid grid-cols-1", expanded ? "gap-3" : "gap-1.5")
      : resolvedLayout === "row"
        ? cn("grid grid-cols-4", dense ? "gap-1" : "gap-2")
        : cn("grid grid-cols-2", expanded ? "gap-4" : "gap-2");

  return (
    <div className={gridClass}>
      {keys.map((key) => renderDimension(key))}
    </div>
  );
}

/** Split a need field into multiple statements when delimited. */
export function splitNeedText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const byNewline = trimmed
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  const bySemicolon = trimmed
    .split(/;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySemicolon.length > 1) return bySemicolon;

  return [trimmed];
}
