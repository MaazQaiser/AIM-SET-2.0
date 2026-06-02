"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Eye, HelpCircle, Presentation, Users } from "lucide-react";
import { ConfidenceTag } from "@/components/confidence-tag";
import { BANTScorecard } from "@/components/bant-scorecard";
import { Button } from "@/components/ui/button";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import { KbDocumentViewerDialog } from "@/components/pre-call/kb-document-viewer-dialog";
import {
  BriefDetailAccordion,
  BriefDetailCard,
  BriefDetailFields,
  BriefDetailRow,
  briefMainBody,
  briefMainLead,
  briefMainMuted,
  briefMainUnderline,
} from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import type {
  AnticipatedObjection,
  CallBrief,
  HypothesizedPain,
  RelevantDocument,
} from "@/lib/brief-types";
import type { BANTScore, Call } from "@/types";

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
const QUESTIONS_PEEK_HEIGHT = "14rem";

function isPresentationDocument(doc: RelevantDocument): boolean {
  const format = doc.format?.toLowerCase();
  const fileName = doc.fileName?.toLowerCase() ?? "";
  const mimeType = doc.mimeType?.toLowerCase() ?? "";
  return (
    format === "ppt" ||
    format === "pptx" ||
    fileName.endsWith(".ppt") ||
    fileName.endsWith(".pptx") ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  );
}

export function BriefBANTCard({
  bant,
  brief,
  call,
  embedded = false,
}: {
  bant: BANTScore;
  brief?: CallBrief;
  call?: Call;
  embedded?: boolean;
}) {
  const provenance = buildBantProvenance(brief, call);
  const openDimensions = (Object.keys(BANT_LABELS) as (keyof BANTScore)[]).filter(
    (k) => bant[k] !== "confirmed"
  );

  const bantBody = (
    <>
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
        <p className="text-xs font-medium text-muted-foreground mt-3 leading-relaxed">
          Still to confirm on the call:{" "}
          {openDimensions.map((k) => BANT_LABELS[k].toLowerCase()).join(", ")}.
        </p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="min-w-0">
        <p className="text-sm font-extrabold tracking-tight text-foreground mb-2">BANT scorecard</p>
        {bantBody}
      </div>
    );
  }

  return (
    <BriefDetailCard
      title="BANT scorecard"
      sourceInfo={{
        source: "Imported data + simple rules",
        detail:
          "This reads BANT clues from the Pre-DC/Post-DC fields and marks anything not clearly confirmed as something to verify on the call.",
      }}
    >
      {bantBody}
    </BriefDetailCard>
  );
}

export function BriefSignalsCard({ signals }: { signals: string[] }) {
  return (
    <BriefDetailCard
      tone="main"
      title="New signals"
      icon={AlertCircle}
      variant="warning"
      className="ring-1 ring-warning/25"
      sourceInfo={{
        source: "AI from Pre-DC notes",
        detail:
          "The workflow looks for important notes that could change call prep, like urgency, unusual context, or extra research signals.",
      }}
      headerExtra={
        <span className="text-[10px] font-semibold uppercase tracking-wide text-warning shrink-0 rounded-full bg-warning/15 px-2 py-0.5">
          {signals.length} new
        </span>
      }
    >
      <ul className="space-y-2">
        {signals.map((signal, i) => (
          <li key={signal}>
            <BriefDetailRow>
              <div className="flex items-start gap-2 min-w-0">
                <span className="shrink-0 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">
                  Signal {i + 1}
                </span>
                <p
                  className={cn(
                    briefMainBody,
                    briefMainLead,
                    briefMainUnderline,
                    "break-words min-w-0 flex-1"
                  )}
                >
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
      tone="main"
      title="Hypothesized pain points"
      sourceInfo={{
        source: "AI from lead research",
        detail:
          "These are likely pains inferred from the prospect's described needs, company context, and fit notes. They are hypotheses to validate, not confirmed facts.",
      }}
      headerExtra={
        <span className="text-xs text-muted-foreground shrink-0">{safePains.length} items</span>
      }
    >
      <ul className="space-y-2">
        {safePains.map((pain, i) => (
          <li key={pain.text}>
            <BriefDetailRow>
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="shrink-0 font-mono text-[10px] font-bold text-primary mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p
                    className={cn(
                      briefMainBody,
                      "italic font-normal",
                      pain.confidence >= 0.7 &&
                        "underline decoration-foreground/40 underline-offset-[3px]",
                      "break-words min-w-0"
                    )}
                  >
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
      tone="main"
      title="Suggested discovery questions"
      icon={HelpCircle}
      scrollMaxHeight={questions.length > VISIBLE_QUESTION_ROWS ? QUESTIONS_PEEK_HEIGHT : undefined}
      sourceInfo={{
        source: "AI and rules from Pre-DC data",
        detail:
          "Questions are chosen from the company needs, tech context, and strategic fit so the AE can confirm the most important unknowns.",
      }}
      headerExtra={
        extra > 0 ? (
          <span className="text-xs text-muted-foreground shrink-0">+{extra} more</span>
        ) : null
      }
    >
      <ol className="divide-y divide-border">
        {questions.map((q, i) => (
          <li
            key={q}
            className="flex gap-3 py-3 min-w-0 first:pt-0 last:pb-0"
          >
            <span className="shrink-0 font-mono text-sm text-primary font-bold w-7 pt-0.5">
              Q{i + 1}
            </span>
            <p className={cn(briefMainBody, "font-normal break-words min-w-0 flex-1")}>
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
    <BriefDetailCard
      tone="main"
      title="Anticipated objections"
      sourceInfo={{
        source: "AI from lead context",
        detail:
          "The workflow predicts likely objections from the lead profile and prepares response angles. Treat these as prep notes, not confirmed buyer statements.",
      }}
    >
      <div className="space-y-2">
        {objections.map((o) => {
          const [handlerLead, ...handlerRest] = o.handler.split(/(?<=\.)\s+/);
          const handlerTail = handlerRest.join(" ").trim();
          return (
            <BriefDetailAccordion
              key={o.objection}
              title={o.objection}
              main
              summary={`Response · ${(o.confidence * 100).toFixed(0)}% confidence`}
            >
              <div className="space-y-2">
                <div className="flex justify-end">
                  <ConfidenceTag score={o.confidence} />
                </div>
                <p
                  className={cn(
                    briefMainBody,
                    briefMainMuted,
                    "break-words border-l-2 border-primary/30 pl-3"
                  )}
                >
                  <span className={cn(briefMainLead, "text-foreground")}>{handlerLead}</span>
                  {handlerTail ? ` ${handlerTail}` : null}
                </p>
              </div>
            </BriefDetailAccordion>
          );
        })}
      </div>
    </BriefDetailCard>
  );
}

export function BriefDeckCard({
  recommendedDeck,
  relevantDocuments,
  callId,
}: {
  recommendedDeck?: CallBrief["recommendedDeck"];
  relevantDocuments?: CallBrief["relevantDocuments"];
  callId?: string;
}) {
  const [activeDoc, setActiveDoc] = useState<RelevantDocument | null>(null);
  const [fetchedDeck, setFetchedDeck] = useState<RelevantDocument | null>(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const localDeck = recommendedDeck ?? (relevantDocuments ?? []).find(isPresentationDocument);
  const deck = localDeck ?? fetchedDeck;

  useEffect(() => {
    if (localDeck || fetchedDeck || !callId) return;
    let cancelled = false;
    setLoadingDeck(true);
    void fetch(`/api/calls/${callId}/relevant-content`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { relevantDocuments?: RelevantDocument[] };
        const match = (data.relevantDocuments ?? []).find(isPresentationDocument);
        if (!cancelled) setFetchedDeck(match ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDeck(false);
      });
    return () => {
      cancelled = true;
    };
  }, [callId, fetchedDeck, localDeck]);

  if (loadingDeck) {
    return (
      <BriefDetailCard
        tone="main"
        title="Recommended deck"
        icon={Presentation}
        sourceInfo={{
          source: "Knowledge base",
          detail:
            "This section searches the KB for one presentation file only: a PPT or PPTX that best matches the account and call context.",
        }}
      >
        <p className={briefMainMuted}>Checking the knowledge base for one PPT/PPTX deck…</p>
      </BriefDetailCard>
    );
  }

  if (!deck) {
    return (
      <BriefDetailCard
        tone="main"
        title="Recommended deck"
        icon={Presentation}
        sourceInfo={{
          source: "Knowledge base",
          detail:
            "The system looked for a PPT/PPTX deck in the KB for this call. If none appears, upload or tag a relevant deck and rerun the workflow.",
        }}
      >
        <p className={briefMainMuted}>No PPT/PPTX deck found in the knowledge base for this call.</p>
      </BriefDetailCard>
    );
  }

  return (
    <>
      <BriefDetailCard
        tone="main"
        title="Recommended deck"
        icon={Presentation}
        sourceInfo={{
          source: "Knowledge base",
          detail:
            "This deck is selected from KB presentation files. The system chooses one PPT/PPTX with the strongest relevance to the account, needs, and service area.",
        }}
      >
        <BriefDetailRow className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <KbFileFormatBadge fileName={deck.fileName} mimeType={deck.mimeType} />
              <p className={cn(briefMainLead, briefMainUnderline, "break-words")}>{deck.title}</p>
              {deck.snippet ? (
                <p className={cn(briefMainMuted, "line-clamp-2")}>{deck.snippet}</p>
              ) : null}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setActiveDoc(deck)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {Math.round(deck.relevanceScore * 100)}% relevance from KB
          </p>
        </BriefDetailRow>
      </BriefDetailCard>

      <KbDocumentViewerDialog
        document={activeDoc}
        open={activeDoc !== null}
        onOpenChange={(open) => !open && setActiveDoc(null)}
      />
    </>
  );
}

export function BriefPodNotesCard({ notes }: { notes: CallBrief["podNotes"] }) {
  return (
    <BriefDetailCard
      tone="main"
      title="Pod-specific notes"
      icon={Users}
      scrollMaxHeight="14rem"
      sourceInfo={{
        source: "AI from Pre-DC context",
        detail:
          "These notes translate the lead research into role-specific prep reminders for the pod, such as what the AE, SE, or designer should watch for.",
      }}
    >
      <ul className="space-y-4">
        {notes.map((note) => (
          <li key={note.memberName}>
            <p
              className={cn(
                briefMainLead,
                briefMainUnderline,
                "text-sm uppercase tracking-wide truncate"
              )}
            >
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
            <p className={cn(briefMainBody, "font-medium break-words mt-1.5")}>{note.note}</p>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}
