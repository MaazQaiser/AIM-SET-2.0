"use client";

import { AlertCircle, FileText, HelpCircle, Presentation, Users } from "lucide-react";
import { ConfidenceTag } from "@/components/confidence-tag";
import { BANTScorecard } from "@/components/bant-scorecard";
import {
  BriefDetailAccordion,
  BriefDetailCard,
  BriefDetailFields,
  BriefDetailRow,
} from "@/components/pre-call/brief-detail-card";
import type { AnticipatedObjection, CallBrief, HypothesizedPain } from "@/lib/brief-types";
import type { BANTScore, Call } from "@/types";
import { cn } from "@/lib/cn";

const BANT_LABELS: Record<keyof BANTScore, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

function buildBantProvenance(brief?: CallBrief, call?: Call): { label: string; value: string }[] {
  if (brief?.postDcPreview?.bant?.length) {
    return brief.postDcPreview.bant.filter((r) => r.value?.trim());
  }

  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string) => {
    if (value?.trim()) rows.push({ label, value: value.trim() });
  };

  for (const section of brief?.researchSections ?? []) {
    for (const item of section.items) {
      const key = item.label.toLowerCase();
      if (
        key.includes("need") ||
        key.includes("revenue") ||
        key.includes("funding") ||
        key.includes("employee") ||
        key.includes("stage") ||
        key.includes("persona") ||
        key.includes("lead") ||
        key.includes("date") ||
        key.includes("icp")
      ) {
        add(item.label, item.value);
      }
    }
  }

  add("Employees", call?.employeeCount);
  add("Annual revenue", call?.annualRevenue);
  add("Industry", call?.industry);

  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.label}:${r.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const VISIBLE_QUESTION_ROWS = 3;
/** ~3 single-line question rows + dividers */
const QUESTIONS_PEEK_HEIGHT = "11.25rem";

export function BriefBANTCard({
  bant,
  brief,
  call,
}: {
  bant: BANTScore;
  brief?: CallBrief;
  call?: Call;
}) {
  const provenance = buildBantProvenance(brief, call);
  const openDimensions = (Object.keys(BANT_LABELS) as (keyof BANTScore)[]).filter(
    (k) => bant[k] !== "confirmed"
  );

  return (
    <BriefDetailCard title="BANT scorecard">
      <BANTScorecard bant={bant} layout="stack" plain />
      {provenance.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Based on
          </p>
          <BriefDetailFields rows={provenance} />
        </div>
      )}
      {openDimensions.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          Still to confirm on the call:{" "}
          {openDimensions.map((k) => BANT_LABELS[k].toLowerCase()).join(", ")}.
        </p>
      )}
    </BriefDetailCard>
  );
}

export function BriefSignalsCard({ signals }: { signals: string[] }) {
  return (
    <BriefDetailCard
      title="New signals"
      icon={AlertCircle}
      variant="warning"
      className="ring-1 ring-warning/25"
      headerExtra={
        <span className="text-[10px] font-semibold uppercase tracking-wide text-warning shrink-0 rounded-full bg-warning/15 px-2 py-0.5">
          {signals.length} new
        </span>
      }
    >
      <ul className="space-y-2">
        {signals.map((signal, i) => (
          <li key={`${signal}-${i}`}>
            <BriefDetailRow className="bg-warning/5 border-warning/30">
              <div className="flex items-start gap-2 min-w-0">
                <span className="shrink-0 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">
                  Signal {i + 1}
                </span>
                <p className="text-sm text-foreground/90 leading-snug break-words min-w-0 flex-1">
                  {signal}
                </p>
              </div>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function BriefPainsCard({ pains }: { pains: HypothesizedPain[] }) {
  const safePains = pains ?? [];
  return (
    <BriefDetailCard
      title="Hypothesized pain points"
      headerExtra={
        <span className="text-xs text-muted-foreground shrink-0">{safePains.length} items</span>
      }
    >
      <ul className="space-y-2">
        {safePains.map((pain, i) => (
          <li key={i}>
            <BriefDetailRow>
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="shrink-0 font-mono text-[10px] font-bold text-primary mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm text-foreground leading-snug break-words min-w-0">
                    {pain.text}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {(pain.confidence * 100).toFixed(0)}%
                  </span>
                  <ConfidenceTag score={pain.confidence} />
                </div>
              </div>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function BriefDiscoveryQuestionsCard({ questions }: { questions: string[] }) {
  const extra = questions.length - VISIBLE_QUESTION_ROWS;

  return (
    <BriefDetailCard
      title="Suggested discovery questions"
      icon={HelpCircle}
      scrollMaxHeight={questions.length > VISIBLE_QUESTION_ROWS ? QUESTIONS_PEEK_HEIGHT : undefined}
      headerExtra={
        extra > 0 ? (
          <span className="text-xs text-muted-foreground shrink-0">+{extra} more</span>
        ) : null
      }
    >
      <ol className="divide-y divide-border">
        {questions.map((q, i) => (
          <li
            key={i}
            className="flex gap-3 py-2.5 text-sm min-w-0 first:pt-0 last:pb-0"
          >
            <span className="shrink-0 font-mono text-xs text-primary font-bold w-6">
              Q{i + 1}
            </span>
            <p className="text-foreground/90 break-words min-w-0 leading-snug flex-1">
              {q}
            </p>
          </li>
        ))}
      </ol>
    </BriefDetailCard>
  );
}

export function BriefObjectionsCard({ objections }: { objections: AnticipatedObjection[] }) {
  return (
    <BriefDetailCard title="Anticipated objections">
      <div className="space-y-2">
        {objections.map((o, i) => (
          <BriefDetailAccordion
            key={i}
            title={o.objection}
            summary={`Response · ${(o.confidence * 100).toFixed(0)}% confidence`}
          >
            <div className="space-y-2">
              <div className="flex justify-end">
                <ConfidenceTag score={o.confidence} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed break-words border-l-2 border-primary/30 pl-3">
                {o.handler}
              </p>
            </div>
          </BriefDetailAccordion>
        ))}
      </div>
    </BriefDetailCard>
  );
}

export function BriefDeckCard({ slides }: { slides: CallBrief["deckSlides"] }) {
  if (!slides || slides.length === 0) {
    return (
      <BriefDetailCard title="Recommended deck" icon={Presentation}>
        <p className="text-xs text-muted-foreground">No deck slides available.</p>
      </BriefDetailCard>
    );
  }
  return (
    <BriefDetailCard title="Recommended deck" icon={Presentation} scrollMaxHeight="14rem">
      <ul className="space-y-2">
        {slides.map((slide) => (
          <li key={slide.id}>
            <BriefDetailRow
              className={cn(
                "flex items-center gap-2",
                !slide.included && "opacity-50"
              )}
            >
              <FileText
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  slide.included ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm truncate",
                  slide.included ? "text-foreground" : "text-muted-foreground line-through"
                )}
              >
                {slide.title}
              </span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {slide.progressedIn}/{slide.usedInCalls}
              </span>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function BriefPodNotesCard({ notes }: { notes: CallBrief["podNotes"] }) {
  return (
    <BriefDetailCard title="Pod-specific notes" icon={Users} scrollMaxHeight="14rem">
      <ul className="space-y-4">
        {notes.map((note) => (
          <li key={note.memberName}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {note.memberName} · {note.role}
            </p>
            {note.reviewedAt && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Reviewed{" "}
                {new Date(note.reviewedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
            <p className="text-sm text-foreground/80 leading-relaxed break-words mt-1.5">
              {note.note}
            </p>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}
