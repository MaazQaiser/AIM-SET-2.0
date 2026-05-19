"use client";

import { useState } from "react";
import { Sparkles, Users, Brain, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PreDcResearchCard } from "@/components/pre-call/pre-dc-research-card";
import { usePostCallReview } from "@/lib/data/hooks";
import { Skeleton } from "@/components/ui/skeleton";

interface PostDCReviewPanelProps {
  callId: string;
}

export function PostDCReviewPanel({ callId }: PostDCReviewPanelProps) {
  const { data: review, isLoading } = usePostCallReview(callId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!review) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No Post-DC notes for this call"
        description="Import post_dc_notes_data.csv in Settings. Rows link when company or lead names match Pre-DC data."
        action={{ label: "Import CSV", href: "/settings" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-foreground leading-relaxed">{review.headline}</p>
          </div>
        </CardContent>
      </Card>

      {review.researchSections && review.researchSections.length > 0 && (
        <PreDcResearchCard sections={review.researchSections} title="Post-DC import (all fields)" />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {review.summary.map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground whitespace-pre-wrap">
              {p}
            </p>
          ))}
        </CardContent>
      </Card>

      {review.podScorecard.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {review.podScorecard.map((row) => (
              <div key={row.member} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {row.member}{" "}
                    <span className="text-muted-foreground font-normal">({row.role})</span>
                  </span>
                  <Badge variant={row.score >= 0.8 ? "success" : row.score >= 0.7 ? "warning" : "secondary"}>
                    {row.label}
                  </Badge>
                </div>
                <p className="text-xs text-foreground">
                  <span className="font-medium">Notes:</span> {row.strengths}
                </p>
                {row.watch && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Watch:</span> {row.watch}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">BANT &amp; learnings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {review.learned.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5 text-xs border-b border-border/50 pb-2 last:border-0">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground whitespace-pre-wrap">{item.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
