"use client";

import { ClipboardList } from "lucide-react";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { PostDcBriefPreview } from "@/lib/brief-types";

interface PostDcBriefPreviewCardProps {
  preview: PostDcBriefPreview;
}

export function PostDcBriefPreviewCard({ preview }: PostDcBriefPreviewCardProps) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full border-dashed border-muted-foreground/30">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap min-w-0">
          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">Post-DC notes (imported)</span>
          {preview.leadStage && (
            <Badge variant="outline" className="text-[10px] capitalize font-normal">
              {preview.leadStage}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-6 gap-y-4" : "space-y-4"
        )}
      >
        {preview.bottomLineContext && (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Bottom line
            </p>
            <p
              className={cn(
                "text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words",
                compact && "line-clamp-5"
              )}
            >
              {preview.bottomLineContext}
            </p>
          </div>
        )}
        {preview.salesStrategy && (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Sales strategy
            </p>
            <p
              className={cn(
                "text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words",
                compact && "line-clamp-5"
              )}
            >
              {preview.salesStrategy}
            </p>
          </div>
        )}
        {preview.engagementModel && (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Engagement model
            </p>
            <p className="text-sm text-foreground/90 break-words">{preview.engagementModel}</p>
          </div>
        )}
        {preview.bant.length > 0 && (
          <div
            className={cn(
              "grid gap-2 min-w-0",
              compact ? "grid-cols-1" : wide ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
            )}
          >
            {preview.bant.map((row) => (
              <div key={row.label} className="rounded-md bg-muted/40 px-2.5 py-2 min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{row.label}</p>
                <p className="text-xs font-medium text-foreground mt-0.5 break-words">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
