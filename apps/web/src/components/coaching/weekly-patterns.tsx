"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { useQuarterlyPatterns } from "@/lib/data/hooks";

export function WeeklyPatterns() {
  const { data: patterns } = useQuarterlyPatterns();

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Patterns emerging this quarter</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {patterns?.map((p) => (
          <Card key={p.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm leading-snug">{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  n={p.sampleSize}
                </Badge>
                <Badge variant={p.strength === "high" ? "success" : "warning"} className="text-xs">
                  {(p.confidence * 100).toFixed(0)}% confidence
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.strength === "medium"
                  ? "Flagged for human review — correlation may be spurious."
                  : "High strength — safe to watch in weekly 1:1s."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
