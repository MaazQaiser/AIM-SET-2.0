"use client";

import Link from "next/link";
import { FileText, Lightbulb, Clock } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { useContentGaps } from "@/lib/data/hooks";

const statusConfig = {
  draft: { variant: "warning" as const, label: "Draft ready" },
  "pending-review": { variant: "secondary" as const, label: "Pending review" },
  approved: { variant: "success" as const, label: "Approved" },
};

export default function ContentPage() {
  const { data: gaps = [] } = useContentGaps();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Content</h1>
          <p className="text-sm text-muted-foreground mt-1">Gaps from discovery calls and the Content Generation Studio</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/content/studio">Open Content Studio</Link>
        </Button>
      </div>

      {gaps.length > 0 ? (
        <div className="space-y-4">
          {gaps.map((gap) => {
            const config = statusConfig[gap.status];
            return (
              <Card key={gap.id} className="hover:shadow-soft-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <CardTitle className="text-sm font-medium">{gap.topic}</CardTitle>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Detected from: {gap.sourcedFrom}
                  </span>
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium capitalize">AI draft {gap.draftType}</span>
                      <AIGeneratedBadge />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Review evidence chain and route priority back to the content agent.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/content/${gap.id}`}>Open in studio</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Lightbulb} title="No content gaps detected" description="Missing assets will appear here." />
      )}
    </div>
  );
}
