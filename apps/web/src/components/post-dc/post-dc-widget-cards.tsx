"use client";

import { Brain, Sparkles, Users } from "lucide-react";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { PostCallReview } from "@/lib/brief-types";

export function PostHeadlineCard({ headline }: { headline: string }) {
  const { compact } = useWidgetSize();
  return (
    <Card className="h-full border-primary/20 bg-primary/5">
      <CardContent className={cn(compact ? "p-3" : "p-4")}>
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p
            className={cn(
              "text-sm font-medium text-foreground leading-relaxed break-words min-w-0",
              compact && "line-clamp-3"
            )}
          >
            {headline}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PostSummaryCard({ summary }: { summary: string[] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-2", compact && "pb-1.5")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Summary
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-6 gap-y-2" : "space-y-2"
        )}
      >
        {summary.map((p, i) => (
          <p
            key={i}
            className={cn(
              "text-sm text-muted-foreground whitespace-pre-wrap break-words min-w-0",
              compact && "line-clamp-4"
            )}
          >
            {p}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

export function PostScorecardCard({ scorecard }: { scorecard: PostCallReview["podScorecard"] }) {
  const { compact, wide } = useWidgetSize();
  if (scorecard.length === 0) return null;

  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-2", compact && "pb-1.5")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Scorecard
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-3" : "space-y-3"
        )}
      >
        {scorecard.map((row) => (
          <div key={row.member} className="rounded-md border p-3 space-y-1 min-w-0">
            <div
              className={cn(
                "gap-2 min-w-0",
                compact
                  ? "flex flex-col items-start"
                  : "flex items-center justify-between"
              )}
            >
              <span className="text-sm font-medium truncate min-w-0">
                {row.member}{" "}
                <span className="text-muted-foreground font-normal">({row.role})</span>
              </span>
              <Badge
                variant={
                  row.score >= 0.8 ? "success" : row.score >= 0.7 ? "warning" : "secondary"
                }
              >
                {row.label}
              </Badge>
            </div>
            <p
              className={cn(
                "text-xs text-foreground break-words",
                compact && "line-clamp-3"
              )}
            >
              <span className="font-medium">Notes:</span> {row.strengths}
            </p>
            {row.watch && !compact && (
              <p className="text-xs text-muted-foreground break-words">
                <span className="font-medium">Watch:</span> {row.watch}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PostLearnedCard({ learned }: { learned: PostCallReview["learned"] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-2", compact && "pb-1.5")}>
        <CardTitle className="text-sm">BANT &amp; learnings</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-4 gap-y-2" : "space-y-2"
        )}
      >
        {learned.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex flex-col gap-0.5 text-xs pb-2 last:border-0 min-w-0",
              wide ? "border-b border-border/50 last:border-b-0" : "border-b border-border/50"
            )}
          >
            <span className="font-medium text-foreground truncate">{item.label}</span>
            <span
              className={cn(
                "text-muted-foreground whitespace-pre-wrap break-words",
                compact && "line-clamp-3"
              )}
            >
              {item.note}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
