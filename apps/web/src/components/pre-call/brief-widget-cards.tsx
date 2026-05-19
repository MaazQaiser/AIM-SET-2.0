"use client";

import { AlertCircle, FileText, HelpCircle, Presentation, Users } from "lucide-react";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { ConfidenceTag } from "@/components/confidence-tag";
import { BANTScorecard } from "@/components/bant-scorecard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnticipatedObjection, CallBrief, HypothesizedPain } from "@/lib/brief-types";
import type { BANTScore } from "@/types";
import { cn } from "@/lib/cn";

export function BriefBANTCard({ bant }: { bant: BANTScore }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm">BANT scorecard</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <BANTScorecard bant={bant} layout={compact ? "stack" : wide ? "row" : "grid"} />
      </CardContent>
    </Card>
  );
}

export function BriefSignalsCard({ signals }: { signals: string[] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <div
      className={cn(
        wide ? "grid grid-cols-2 gap-2" : "space-y-2"
      )}
    >
      {signals.map((signal) => (
        <div
          key={signal}
          className={cn(
            "flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 text-sm min-w-0",
            compact ? "px-3 py-2" : "px-4 py-3"
          )}
        >
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <SignalBody signal={signal} compact={compact} />
        </div>
      ))}
    </div>
  );
}

function SignalBody({ signal, compact }: { signal: string; compact: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-foreground/90 mb-0.5">New signal</p>
      <p className={cn("text-foreground/80 break-words", compact && "line-clamp-2")}>{signal}</p>
    </div>
  );
}

export function BriefPainsCard({ pains }: { pains: HypothesizedPain[] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm">Hypothesized pain points</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-4 gap-y-3" : "space-y-2.5"
        )}
      >
        {pains.map((pain, i) => (
          <div
            key={i}
            className={cn(
              "min-w-0",
              compact
                ? "space-y-1"
                : "flex items-start justify-between gap-3"
            )}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <p
                className={cn(
                  "text-sm text-foreground leading-snug break-words min-w-0",
                  compact && "line-clamp-3"
                )}
              >
                {pain.text}
              </p>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 shrink-0",
                compact && "pl-3.5"
              )}
            >
              {!compact && (
                <span className="text-xs font-mono text-muted-foreground">
                  {(pain.confidence * 100).toFixed(0)}%
                </span>
              )}
              <ConfidenceTag score={pain.confidence} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BriefDiscoveryQuestionsCard({ questions }: { questions: string[] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          Suggested discovery questions
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-4 gap-y-2.5" : "space-y-2.5"
        )}
      >
        {questions.map((q, i) => (
          <QuestionRow key={i} index={i} question={q} compact={compact} />
        ))}
      </CardContent>
    </Card>
  );
}

function QuestionRow({
  index,
  question,
  compact,
}: {
  index: number;
  question: string;
  compact: boolean;
}) {
  return (
    <div className="flex gap-3 text-sm min-w-0">
      <span className="shrink-0 font-mono text-xs text-primary font-bold mt-0.5">
        Q{index + 1}
      </span>
      <p
        className={cn(
          "text-foreground/90 break-words min-w-0",
          compact && "line-clamp-3"
        )}
      >
        {question}
      </p>
    </div>
  );
}

export function BriefObjectionsCard({ objections }: { objections: AnticipatedObjection[] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm">Anticipated objections</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-x-4 gap-y-4" : "space-y-4"
        )}
      >
        {objections.map((o, i) => (
          <div key={i} className="space-y-1.5 min-w-0">
            <div
              className={cn(
                "gap-2 min-w-0",
                compact
                  ? "flex flex-col items-start"
                  : "flex items-start justify-between"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold text-foreground break-words min-w-0 flex-1",
                  compact && "line-clamp-2"
                )}
              >
                {o.objection}
              </p>
              <ConfidenceTag score={o.confidence} />
            </div>
            <div className="pl-3 border-l-2 border-primary/30">
              <p
                className={cn(
                  "text-sm text-muted-foreground leading-relaxed break-words",
                  compact && "line-clamp-3"
                )}
              >
                {o.handler}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BriefDeckCard({ slides }: { slides: CallBrief["deckSlides"] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Presentation className="h-4 w-4 text-muted-foreground" />
          Recommended deck
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-2" : "space-y-2"
        )}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm min-w-0",
              slide.included ? "bg-card" : "opacity-50 bg-muted/30",
              compact ? "justify-start" : "justify-between"
            )}
          >
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <FileText
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  slide.included ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "min-w-0 truncate",
                  slide.included ? "text-foreground" : "text-muted-foreground line-through"
                )}
              >
                {slide.title}
              </span>
            </span>
            {!compact && (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {slide.progressedIn}/{slide.usedInCalls} progressed
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BriefPodNotesCard({ notes }: { notes: CallBrief["podNotes"] }) {
  const { compact, wide } = useWidgetSize();
  return (
    <Card className="h-full">
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Pod-specific notes
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-3" : "space-y-3"
        )}
      >
        {notes.map((note) => (
          <div key={note.memberName} className="rounded-md bg-muted/40 px-3 py-2.5 min-w-0">
            <div
              className={cn(
                "mb-1 gap-2 min-w-0",
                compact
                  ? "flex flex-col items-start"
                  : "flex items-center justify-between"
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate min-w-0">
                {note.memberName} · {note.role}
              </p>
              {!compact && note.reviewedAt && (
                <p className="text-[10px] text-muted-foreground shrink-0">
                  Reviewed{" "}
                  {new Date(note.reviewedAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <p
              className={cn(
                "text-sm text-foreground/80 leading-relaxed break-words",
                compact && "line-clamp-3"
              )}
            >
              {note.note}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
