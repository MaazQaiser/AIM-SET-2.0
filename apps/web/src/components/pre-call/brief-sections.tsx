"use client";

import Link from "next/link";
import { FileText, Users, AlertCircle, Presentation, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceTag } from "@/components/confidence-tag";
import { BANTScorecard } from "@/components/bant-scorecard";
import { BriefAISummary } from "./brief-ai-summary";
import { ClientAttendeesCard } from "./client-attendees-card";
import { ClientHistoryCard } from "./client-history-card";
import { PreDcResearchCard } from "./pre-dc-research-card";
import { PostDcBriefPreviewCard } from "./post-dc-brief-preview";
import type { CallBrief } from "@/lib/mock-data";
import type { BANTScore } from "@/types";
import { cn } from "@/lib/cn";

interface BriefSectionsProps {
  brief: CallBrief;
  bant?: BANTScore;
  discoveryQuestions?: string[];
  leadershipPreview?: boolean;
}

export function BriefSections({ brief, bant, discoveryQuestions = [], leadershipPreview }: BriefSectionsProps) {
  return (
    <div className="space-y-5">
      {/* Leadership notice */}
      {leadershipPreview && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
          Leadership read-only preview — brief updates as the AE prepares.
        </div>
      )}

      {/* 1. AI Executive Summary */}
      <BriefAISummary brief={brief} />

      {brief.researchSections && brief.researchSections.length > 0 && (
        <PreDcResearchCard sections={brief.researchSections} />
      )}

      {brief.postDcPreview && <PostDcBriefPreviewCard preview={brief.postDcPreview} />}

      {/* 2. New signals / alerts */}
      {brief.newSignals.map((signal) => (
        <div
          key={signal}
          className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground/90 mb-0.5">New signal</p>
            <p className="text-foreground/80">{signal}</p>
          </div>
        </div>
      ))}

      {/* 3. Client attendees */}
      {brief.clientAttendees.length > 0 && (
        <ClientAttendeesCard attendees={brief.clientAttendees} />
      )}

      {/* 4. Client interaction history */}
      {brief.interactionHistory.length > 0 && (
        <ClientHistoryCard interactions={brief.interactionHistory} />
      )}

      {/* 5. BANT scorecard */}
      {bant && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">BANT scorecard</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BANTScorecard bant={bant} />
          </CardContent>
        </Card>
      )}

      {/* 6. Hypothesized pain points */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Hypothesized pain points</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2.5">
          {brief.pains.map((pain, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-sm text-foreground leading-snug">{pain.text}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono text-muted-foreground">{(pain.confidence * 100).toFixed(0)}%</span>
                <ConfidenceTag score={pain.confidence} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 7. Discovery questions */}
      {discoveryQuestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Suggested discovery questions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {discoveryQuestions.map((q, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs text-primary font-bold mt-0.5">Q{i + 1}</span>
                <p className="text-foreground/90">{q}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 8. Anticipated objections */}
      {brief.objections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Anticipated objections</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {brief.objections.map((o, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{o.objection}</p>
                  <ConfidenceTag score={o.confidence} />
                </div>
                <div className="pl-3 border-l-2 border-primary/30">
                  <p className="text-sm text-muted-foreground leading-relaxed">{o.handler}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 9. Recommended deck */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Presentation className="h-4 w-4 text-muted-foreground" />
            Recommended deck
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {brief.deckSlides.map((slide) => (
            <div
              key={slide.id}
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                slide.included ? "bg-card" : "opacity-50 bg-muted/30"
              )}
            >
              <span className="flex items-center gap-2">
                <FileText className={cn("h-3.5 w-3.5 shrink-0", slide.included ? "text-primary" : "text-muted-foreground")} />
                <span className={slide.included ? "text-foreground" : "text-muted-foreground line-through"}>
                  {slide.title}
                </span>
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {slide.progressedIn}/{slide.usedInCalls} progressed
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 10. Pod-specific notes */}
      {brief.podNotes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Pod-specific notes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {brief.podNotes.map((note) => (
              <div key={note.memberName} className="rounded-md bg-muted/40 px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {note.memberName} · {note.role}
                  </p>
                  {note.reviewedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Reviewed {new Date(note.reviewedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{note.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Link href="/knowledge" className="block text-xs text-primary hover:underline pt-1">
        Open knowledge base for case studies →
      </Link>
    </div>
  );
}
