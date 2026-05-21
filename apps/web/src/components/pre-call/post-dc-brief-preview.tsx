"use client";

import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BriefDetailAccordion,
  BriefDetailCard,
  BriefDetailRow,
} from "@/components/pre-call/brief-detail-card";
import type { PostDcBriefPreview } from "@/lib/brief-types";

interface PostDcBriefPreviewCardProps {
  preview: PostDcBriefPreview;
}

export function PostDcBriefPreviewCard({ preview }: PostDcBriefPreviewCardProps) {
  return (
    <BriefDetailCard
      title="Post-DC notes (imported)"
      icon={ClipboardList}
      className="border-dashed"
      headerExtra={
        preview.leadStage ? (
          <Badge variant="outline" className="text-[10px] capitalize font-normal shrink-0">
            {preview.leadStage}
          </Badge>
        ) : null
      }
      scrollMaxHeight="14rem"
    >
      <div className="space-y-2">
        {preview.bottomLineContext && (
          <BriefDetailAccordion title="Bottom line" summary="Imported context">
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
              {preview.bottomLineContext}
            </p>
          </BriefDetailAccordion>
        )}
        {preview.salesStrategy && (
          <BriefDetailAccordion title="Sales strategy" summary="Go-to-call plan">
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
              {preview.salesStrategy}
            </p>
          </BriefDetailAccordion>
        )}
        {preview.engagementModel && (
          <BriefDetailRow>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Engagement model
            </p>
            <p className="text-sm text-foreground/90 break-words mt-0.5">{preview.engagementModel}</p>
          </BriefDetailRow>
        )}
        {preview.bant.length > 0 && (
          <BriefDetailAccordion
            title="BANT snapshot"
            summary={`${preview.bant.length} fields`}
          >
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {preview.bant.map((row) => (
                <BriefDetailRow key={row.label}>
                  <p className="text-[10px] text-muted-foreground truncate">{row.label}</p>
                  <p className="text-xs font-medium text-foreground mt-0.5 break-words">{row.value}</p>
                </BriefDetailRow>
              ))}
            </div>
          </BriefDetailAccordion>
        )}
      </div>
    </BriefDetailCard>
  );
}
