"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderKanban, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  BriefDetailCard,
  BRIEF_RELEVANT_CONTENT_SCROLL_MAX,
  briefMainLead,
  briefMainMuted,
  briefMainUnderline,
} from "@/components/pre-call/brief-detail-card";
import { KbDocumentViewerDialog } from "@/components/pre-call/kb-document-viewer-dialog";
import { RelevantProjectDetailDialog } from "@/components/pre-call/relevant-project-detail-dialog";
import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import type { CallBrief, RelevantDocument, RelevantProject } from "@/lib/brief-types";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

export type BriefRelevantContentSection = "all" | "documents" | "projects";

function hasRelevantContent(brief: CallBrief): boolean {
  return Boolean(
    brief.relevantDocuments?.length ||
      brief.relevantProjects?.length ||
      brief.recommendedDeck
  );
}

async function fetchRelevantContent(callId: string, refresh: boolean) {
  const res = await fetch(
    `/api/calls/${encodeURIComponent(callId)}/relevant-content?refresh=${refresh ? "true" : "false"}`
  );
  if (!res.ok) throw new Error("Failed to load relevant content");
  return res.json() as Promise<{
    relevantDocuments?: CallBrief["relevantDocuments"];
    relevantProjects?: CallBrief["relevantProjects"];
    recommendedDeck?: CallBrief["recommendedDeck"];
    cached?: boolean;
  }>;
}

interface BriefRelevantContentProps {
  brief: CallBrief;
  className?: string;
  /** Body only — used inside tabbed Discovery Call Artifacts card */
  embedded?: boolean;
  /** When embedded in tabbed panel — show one KB section per tab */
  section?: BriefRelevantContentSection;
}

function RelevanceBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.round(score * 100);
  return (
    <div className={cn("flex w-full max-w-[220px] items-center gap-2", className)}>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-colors"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
        {pct}%
      </span>
    </div>
  );
}

function relevantContentEmptyMessage(section: BriefRelevantContentSection): string {
  if (section === "documents") {
    return "No matching documents for this call yet. Upload decks in Knowledge, then re-import the lead or generate the brief.";
  }
  if (section === "projects") {
    return "No matching projects for this call yet. Add project notes in Knowledge, then re-import the lead or generate the brief.";
  }
  return "No matching knowledge base content for this call yet. Upload decks in Knowledge, then re-import the lead or generate the brief.";
}

export function BriefRelevantContent({
  brief,
  className,
  embedded = false,
  section = "all",
}: BriefRelevantContentProps) {
  const documents = brief.relevantDocuments ?? [];
  const projects = brief.relevantProjects ?? [];
  const showDocuments = section === "all" || section === "documents";
  const showProjects = section === "all" || section === "projects";
  const visibleDocuments = showDocuments ? documents : [];
  const visibleProjects = showProjects ? projects : [];
  const [activeDoc, setActiveDoc] = useState<RelevantDocument | null>(null);
  const [activeProject, setActiveProject] = useState<RelevantProject | null>(null);

  const isEmpty = visibleDocuments.length === 0 && visibleProjects.length === 0;

  if (isEmpty) {
    if (embedded) {
      return (
        <p className="text-sm text-muted-foreground py-2">{relevantContentEmptyMessage(section)}</p>
      );
    }
    if (section === "all") return null;
    return null;
  }

  const body = (
    <>
      <p className={cn(briefMainMuted, embedded ? "mb-3" : "-mt-2 mb-3")}>
        From your knowledge base — use View to preview in the app.
      </p>
      <div className="space-y-5 min-w-0">
        {visibleDocuments.length > 0 && (
          <div className="space-y-2">
            {section === "all" ? (
              <p className="text-xs font-medium text-muted-foreground">Documents</p>
            ) : null}
            <ul className="space-y-0">
              {visibleDocuments.map((doc) => (
                <li
                  key={doc.assetId}
                  className="border-b border-border/40 px-6 py-3 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <KbFileTypeIcon
                        fileName={doc.fileName}
                        mimeType={doc.mimeType}
                        className="h-9 w-9"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            briefMainLead,
                            doc.relevanceScore >= 0.7 && briefMainUnderline,
                            "break-words"
                          )}
                        >
                          {doc.title}
                        </p>
                        <RelevanceBar score={doc.relevanceScore} className="mt-2" />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2.5 text-xs font-medium"
                      onClick={() => setActiveDoc(doc)}
                    >
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {visibleProjects.length > 0 && (
          <div className="space-y-2">
            {section === "all" ? (
              <p className="text-xs font-medium text-muted-foreground">Relevant projects</p>
            ) : null}
            <ul className="divide-y divide-border/40">
              {visibleProjects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => setActiveProject(project)}
                    className="w-full border-0 bg-transparent px-6 py-2.5 text-left transition-opacity hover:opacity-80"
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
                      <RelevanceBar
                        score={project.relevanceScore}
                        className="max-w-[88px] shrink-0"
                      />
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
    </>
  );

  if (embedded) {
    return (
      <>
        {body}
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
        {body}
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

export function useRelevantContentBrief(callId: string, brief: CallBrief) {
  const [merged, setMerged] = useState<CallBrief>(brief);
  const [loading, setLoading] = useState(!hasRelevantContent(brief));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setMerged(brief);
    if (hasRelevantContent(brief)) {
      setLoading(false);
    }
  }, [brief]);

  useEffect(() => {
    if (hasRelevantContent(brief)) return;

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await fetchRelevantContent(callId, false);
        if (cancelled) return;
        setMerged((prev) => ({
          ...prev,
          relevantDocuments: data.relevantDocuments?.length
            ? data.relevantDocuments
            : prev.relevantDocuments,
          relevantProjects: data.relevantProjects?.length
            ? data.relevantProjects
            : prev.relevantProjects,
          recommendedDeck: data.recommendedDeck ?? prev.recommendedDeck,
        }));
      } catch {
        // Keep the brief usable if the API is temporarily unreachable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callId, brief]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchRelevantContent(callId, true);
      setMerged((prev) => ({
        ...prev,
        relevantDocuments: data.relevantDocuments ?? prev.relevantDocuments,
        relevantProjects: data.relevantProjects ?? prev.relevantProjects,
        recommendedDeck: data.recommendedDeck ?? prev.recommendedDeck,
      }));
      toast.success("Relevant content refreshed from knowledge base");
    } catch {
      toast.error("Could not refresh relevant content");
    } finally {
      setRefreshing(false);
    }
  }, [callId]);

  return { merged, loading, refresh, refreshing };
}

export function BriefRelevantContentLoader({
  callId,
  brief,
  embedded = false,
  section = "all",
}: {
  callId: string;
  brief: CallBrief;
  embedded?: boolean;
  section?: BriefRelevantContentSection;
}) {
  const { merged, loading, refresh, refreshing } = useRelevantContentBrief(callId, brief);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading relevant content from knowledge base…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh KB matches
        </Button>
      </div>
      <BriefRelevantContent brief={merged} embedded={embedded} section={section} />
    </div>
  );
}
