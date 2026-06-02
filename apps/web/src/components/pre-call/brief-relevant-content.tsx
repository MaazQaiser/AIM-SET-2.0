"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Loader2 } from "lucide-react";
import {
  BriefDetailCard,
  BRIEF_RELEVANT_CONTENT_SCROLL_MAX,
  briefMainLead,
  briefMainMuted,
  briefMainUnderline,
} from "@/components/pre-call/brief-detail-card";
import { KbDocumentViewerDialog } from "@/components/pre-call/kb-document-viewer-dialog";
import { RelevantProjectDetailDialog } from "@/components/pre-call/relevant-project-detail-dialog";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import type { CallBrief, RelevantDocument, RelevantProject } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface BriefRelevantContentProps {
  brief: CallBrief;
  className?: string;
}

function relevanceBarFillClass(pct: number): string {
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 50) return "bg-amber-400";
  return "bg-destructive/70";
}

function relevanceBarTextClass(pct: number): string {
  if (pct >= 90) return "text-emerald-700 dark:text-emerald-400";
  if (pct >= 70) return "text-primary";
  if (pct >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-destructive";
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2 min-w-[88px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-colors", relevanceBarFillClass(pct))}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={cn("text-[10px] tabular-nums w-8 text-right", relevanceBarTextClass(pct))}>
        {pct}%
      </span>
    </div>
  );
}

export function BriefRelevantContent({ brief, className }: BriefRelevantContentProps) {
  const documents = brief.relevantDocuments ?? [];
  const projects = brief.relevantProjects ?? [];
  const [activeDoc, setActiveDoc] = useState<RelevantDocument | null>(null);
  const [activeProject, setActiveProject] = useState<RelevantProject | null>(null);

  if (documents.length === 0 && projects.length === 0) {
    return null;
  }

  return (
    <>
      <BriefDetailCard
        tone="main"
        title="Relevant content"
        icon={FolderKanban}
        className={className}
        scrollMaxHeight={BRIEF_RELEVANT_CONTENT_SCROLL_MAX}
        sourceInfo={{
          source: "Knowledge base search",
          detail:
            "The system searches KB documents and project notes using the account name, needs, industry, service area, and company description, then ranks the closest matches.",
        }}
      >
        <p className={cn(briefMainMuted, "-mt-2 mb-3")}>
          From your knowledge base — click to preview in the app.
        </p>
        <div className="space-y-5 min-w-0">
          {documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documents</p>
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.assetId}>
                    <button
                      type="button"
                      onClick={() => setActiveDoc(doc)}
                      className={cn(
                        "w-full text-left border-b border-border/40 py-3 last:border-b-0",
                        "hover:opacity-80 transition-opacity"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                          <KbFileFormatBadge fileName={doc.fileName} mimeType={doc.mimeType} />
                          <p
                            className={cn(
                              briefMainLead,
                              doc.relevanceScore >= 0.7 && briefMainUnderline,
                              "truncate w-full sm:w-auto"
                            )}
                          >
                            {doc.title}
                          </p>
                        </div>
                        <RelevanceBar score={doc.relevanceScore} />
                      </div>
                      {doc.snippet ? (
                        <p className={cn(briefMainMuted, "mt-2 line-clamp-2")}>{doc.snippet}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {projects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Relevant projects</p>
              <ul className="divide-y divide-border/40">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => setActiveProject(project)}
                      className="w-full text-left py-2.5 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            briefMainLead,
                            project.relevanceScore >= 0.7 && briefMainUnderline,
                            "truncate flex-1 min-w-0"
                          )}
                        >
                          {project.title}
                        </span>
                        <RelevanceBar score={project.relevanceScore} />
                      </div>
                      {project.summary ? (
                        <p className={cn(briefMainMuted, "mt-1 line-clamp-1")}>{project.summary}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </BriefDetailCard>

      <KbDocumentViewerDialog
        document={activeDoc}
        open={activeDoc !== null}
        onOpenChange={(open) => !open && setActiveDoc(null)}
      />
      <RelevantProjectDetailDialog
        project={activeProject}
        open={activeProject !== null}
        onOpenChange={(open) => !open && setActiveProject(null)}
      />
    </>
  );
}

export function BriefRelevantContentLoader({ callId, brief }: { callId: string; brief: CallBrief }) {
  const [merged, setMerged] = useState<CallBrief>(brief);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMerged(brief);
  }, [brief]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/calls/${callId}/relevant-content`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          relevantDocuments?: CallBrief["relevantDocuments"];
          relevantProjects?: CallBrief["relevantProjects"];
        };
        if (cancelled) return;
        setMerged((prev) => ({
          ...prev,
          relevantDocuments: data.relevantDocuments?.length
            ? data.relevantDocuments
            : prev.relevantDocuments,
          relevantProjects: data.relevantProjects?.length ? data.relevantProjects : prev.relevantProjects,
        }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading relevant content from knowledge base…
      </div>
    );
  }

  const display = merged;
  if ((display.relevantDocuments?.length ?? 0) === 0 && (display.relevantProjects?.length ?? 0) === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No matching knowledge base content for this call yet. Upload decks in Knowledge, then re-import the lead or
        generate the brief.
      </p>
    );
  }

  return <BriefRelevantContent brief={display} />;
}
