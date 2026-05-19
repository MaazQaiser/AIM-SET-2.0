"use client";

import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PostDcBriefPreview } from "@/lib/mock-data";

interface PostDcBriefPreviewCardProps {
  preview: PostDcBriefPreview;
}

export function PostDcBriefPreviewCard({ preview }: PostDcBriefPreviewCardProps) {
  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Post-DC notes (imported)
          {preview.leadStage && (
            <Badge variant="outline" className="text-[10px] capitalize font-normal">
              {preview.leadStage}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {preview.bottomLineContext && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Bottom line
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {preview.bottomLineContext}
            </p>
          </div>
        )}
        {preview.salesStrategy && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Sales strategy
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {preview.salesStrategy}
            </p>
          </div>
        )}
        {preview.engagementModel && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Engagement model
            </p>
            <p className="text-sm text-foreground/90">{preview.engagementModel}</p>
          </div>
        )}
        {preview.bant.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {preview.bant.map((row) => (
              <div key={row.label} className="rounded-md bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">{row.label}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
