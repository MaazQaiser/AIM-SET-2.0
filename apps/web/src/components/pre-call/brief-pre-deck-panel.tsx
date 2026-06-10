"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FolderKanban, Layers3, Library, Loader2, Presentation, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import {
  BriefDetailCard,
  BRIEF_PARALLEL_CARD_SCROLL_MAX,
  briefDetailDialogClass,
  briefMainMuted,
} from "@/components/pre-call/brief-detail-card";
import type { PreDeck, PreDeckSlide, RelevantDocument, RelevantProject } from "@/lib/brief-types";
import { createProjectFromPreDeck } from "@/lib/content/create-project-from-suggestion";
import { cn } from "@/lib/cn";

interface BriefPreDeckPanelProps {
  deck?: PreDeck;
  callId?: string;
  accountName?: string;
  industry?: string;
  relevantDocuments?: RelevantDocument[];
  relevantProjects?: RelevantProject[];
  recommendedDeck?: RelevantDocument | null;
}

interface RelevantContentPayload {
  relevantDocuments?: RelevantDocument[];
  relevantProjects?: RelevantProject[];
  recommendedDeck?: RelevantDocument | null;
}

const NOISY_KB_MARKERS = [
  "thank you",
  "all rights reserved",
  "freedom drive",
  "services@",
  "drop us a line",
  "other offices",
  "www.tkxel",
  "dammam",
  "lisbon",
  "lahore",
];

const STALE_SUGGESTION_MARKERS = [
  "tk overview deck",
  "tkxel overview deck",
  "service one-pager",
  "service one pager",
  "one-pager",
  "one pager",
  "case study",
];

function cleanText(value?: string | null): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function isNoisyText(value?: string | null): boolean {
  const text = cleanText(value).toLowerCase();
  return Boolean(text && NOISY_KB_MARKERS.some((marker) => text.includes(marker)));
}

function isGenericProofSlide(slide: PreDeckSlide): boolean {
  const title = cleanText(slide.title).toLowerCase();
  return title === "relevant proof point" || title === "proof point";
}

function isNoisySlide(slide: PreDeckSlide): boolean {
  const combined = `${slide.title} ${slide.narrative} ${slide.previewText ?? ""}`;
  return (
    isNoisyText(combined) ||
    isStaleSuggestionSlide(slide) ||
    (slide.sourceType === "knowledge_base" && isGenericProofSlide(slide))
  );
}

function isStaleSuggestionSlide(slide: PreDeckSlide): boolean {
  if (slide.sourceType !== "workflow") return false;
  const combined = cleanText(`${slide.title} ${slide.narrative} ${slide.previewText ?? ""}`).toLowerCase();
  if (!combined.includes("prepare these assets") && !combined.includes("recommended talk track")) {
    return false;
  }
  return STALE_SUGGESTION_MARKERS.some((marker) => combined.includes(marker));
}

function scoreSort<T extends { relevanceScore: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function mergeDocuments(
  recommendedDeck?: RelevantDocument | null,
  documents: RelevantDocument[] = []
): RelevantDocument[] {
  const merged = recommendedDeck ? [recommendedDeck, ...documents] : documents;
  const seen = new Set<string>();
  return scoreSort(
    merged.filter((doc) => {
      if (seen.has(doc.assetId)) return false;
      seen.add(doc.assetId);
      return true;
    })
  );
}

function mergeProjects(projects: RelevantProject[] = []): RelevantProject[] {
  const seen = new Set<string>();
  return scoreSort(
    projects.filter((project) => {
      const key = project.id || project.assetId || project.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  );
}

function isGenericCompanyDocument(doc: RelevantDocument): boolean {
  const title = cleanText(doc.title).toLowerCase();
  return (
    title.includes("company overview") ||
    title.includes("tk overview") ||
    title.includes("tkxel overview")
  );
}

function compactEvidence(value?: string): string {
  const text = cleanText(value);
  return isNoisyText(text) ? "" : text;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function accountLabel(accountName?: string): string {
  return cleanText(accountName) || "this lead";
}

function buildProjectSlide(
  projects: RelevantProject[],
  accountName?: string,
  industry?: string
): PreDeckSlide | null {
  const topProjects = projects.slice(0, 3);
  if (topProjects.length === 0) return null;

  const names = topProjects.map((project) => project.title);
  const proofLines = topProjects
    .map((project) => {
      const evidence = compactEvidence(project.summary) || compactEvidence(project.details);
      return evidence ? `${project.title}: ${evidence}` : project.title;
    })
    .filter(Boolean);

  const first = topProjects[0];
  const context = industry ? `${industry} conversation` : "discovery conversation";
  return {
    id: "predeck-project-library",
    title: "Relevant projects from library",
    sourceType: "project_database",
    sourceId: first.id,
    assetId: first.assetId,
    narrative: `Use ${joinList(names)} as proof for ${accountLabel(accountName)}'s ${context}. Confirm which example best matches the lead's environment before taking the deck forward.`,
    previewText: proofLines.join("\n\n"),
  };
}

function buildKbSlide(
  documents: RelevantDocument[],
  accountName?: string,
  industry?: string
): PreDeckSlide | null {
  const specificDocs = documents.filter((doc) => !isGenericCompanyDocument(doc));
  const topDocuments = (specificDocs.length > 0 ? specificDocs : documents).slice(0, 3);
  if (topDocuments.length === 0) return null;

  const names = topDocuments.map((doc) => doc.title);
  const notes = topDocuments
    .map((doc) => {
      const evidence = compactEvidence(doc.snippet) || compactEvidence(doc.previewText);
      return evidence ? `${doc.title}: ${evidence}` : doc.title;
    })
    .filter(Boolean);
  const first = topDocuments[0];
  const context = industry ? `${industry} angle` : "call angle";
  return {
    id: "predeck-kb-assets",
    title: "KB assets to reference",
    sourceType: "knowledge_base",
    sourceId: first.assetId,
    assetId: first.assetId,
    narrative: `Reference ${joinList(names)} for ${accountLabel(accountName)}'s ${context}. Use these assets as supporting content, not as generic closing slides.`,
    previewText: notes.join("\n\n"),
  };
}

function buildDefaultWorkflowSlides(accountName?: string, industry?: string): PreDeckSlide[] {
  const account = accountLabel(accountName);
  return [
    {
      id: "predeck-objective",
      title: "Objective and agenda",
      sourceType: "workflow",
      narrative: `Align on ${account}'s current priorities, validate the strongest pain hypothesis, and agree the next useful content step.`,
    },
    {
      id: "predeck-account-hypothesis",
      title: "Account hypothesis",
      sourceType: "workflow",
      narrative: `Lead with ${industry ? `${industry} ` : ""}workflow, data, and integration questions; confirm urgency, decision owners, and proof needed for a follow-up deck.`,
    },
  ];
}

function buildProjectGapSlide(accountName?: string, industry?: string): PreDeckSlide {
  return {
    id: "predeck-project-proof-gap",
    title: "Project proof to add",
    sourceType: "workflow",
    narrative: `No project-library match is attached yet for ${accountLabel(accountName)}. Add a relevant ${industry ? `${industry} ` : ""}project before finalizing the deck so the proof point is specific, not generic.`,
  };
}

function buildCloseSlide(accountName?: string, industry?: string): PreDeckSlide {
  return {
    id: "predeck-close-plan",
    title: "Close plan",
    sourceType: "workflow",
    narrative: `End by confirming whether ${accountLabel(accountName)} wants a focused ${industry ? `${industry} ` : ""}deck that includes the project proof and KB assets above.`,
  };
}

function buildDeckSummary({
  accountName,
  industry,
  documents,
  projects,
}: {
  accountName?: string;
  industry?: string;
  documents: RelevantDocument[];
  projects: RelevantProject[];
}): string {
  const parts = [`${accountLabel(accountName)} pre-call deck`];
  if (industry) parts.push(`${industry} angle`);
  if (projects.length > 0) {
    parts.push(`project proof: ${projects.slice(0, 2).map((project) => project.title).join(", ")}`);
  } else {
    parts.push("project proof needed");
  }
  if (documents.length > 0) {
    const specificDocs = documents.filter((doc) => !isGenericCompanyDocument(doc));
    const docNames = (specificDocs.length > 0 ? specificDocs : documents)
      .slice(0, 2)
      .map((doc) => doc.title);
    parts.push(`KB support: ${docNames.join(", ")}`);
  }
  return `${parts.join(" · ")}.`;
}

function buildDisplayDeck({
  deck,
  accountName,
  industry,
  documents,
  projects,
}: {
  deck?: PreDeck;
  accountName?: string;
  industry?: string;
  documents: RelevantDocument[];
  projects: RelevantProject[];
}): PreDeck | null {
  const cleanSlides = (deck?.slides ?? []).filter((slide) => !isNoisySlide(slide));
  const workflowSlides = cleanSlides.filter((slide) => slide.sourceType === "workflow").slice(0, 3);
  const projectSlide = buildProjectSlide(projects, accountName, industry);
  const projectGapSlide = projectSlide ? null : buildProjectGapSlide(accountName, industry);
  const kbSlide = buildKbSlide(documents, accountName, industry);
  const retainedEvidenceSlides =
    projectSlide || kbSlide
      ? []
      : cleanSlides.filter((slide) => slide.sourceType !== "workflow").slice(0, 2);
  const slides = [
    ...(workflowSlides.length > 0
      ? workflowSlides
      : buildDefaultWorkflowSlides(accountName, industry)),
    ...(projectSlide ? [projectSlide] : []),
    ...(projectGapSlide ? [projectGapSlide] : []),
    ...(kbSlide ? [kbSlide] : []),
    ...retainedEvidenceSlides,
  ];

  if (!slides.some((slide) => cleanText(slide.title).toLowerCase().includes("close"))) {
    slides.push(buildCloseSlide(accountName, industry));
  }

  const uniqueSlides = slides
    .filter((slide) => cleanText(slide.title) && cleanText(slide.narrative))
    .filter((slide, index, allSlides) => allSlides.findIndex((item) => item.id === slide.id) === index)
    .slice(0, 6);

  if (uniqueSlides.length === 0) return null;
  const hasProjectProof =
    Boolean(projectSlide) ||
    retainedEvidenceSlides.some((slide) => slide.sourceType === "project_database");

  return {
    title: `${accountLabel(accountName)} pre-call deck`,
    status: hasProjectProof ? "ready" : "needs_content",
    summary: buildDeckSummary({ accountName, industry, documents, projects }),
    slides: uniqueSlides,
  };
}

async function fetchRelevantContent(callId: string): Promise<RelevantContentPayload> {
  const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/relevant-content?refresh=false`);
  if (!res.ok) return {};
  return res.json() as Promise<RelevantContentPayload>;
}

function SlideSourceBadge({ slide }: { slide: PreDeckSlide }) {
  const fromKb = slide.sourceType === "knowledge_base";
  const fromProject = slide.sourceType === "project_database";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 type-caption",
        fromProject
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : fromKb
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-primary/25 bg-primary/10 text-primary"
      )}
    >
      {fromProject ? (
        <FolderKanban className="h-3 w-3" />
      ) : fromKb ? (
        <Library className="h-3 w-3" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      {fromProject ? "Project" : fromKb ? "KB" : "Workflow"}
    </Badge>
  );
}

function hasDistinctPreview(slide: PreDeckSlide) {
  const preview = slide.previewText?.trim();
  return Boolean(preview && preview !== slide.narrative.trim());
}

export function BriefPreDeckPanel({
  deck,
  callId,
  accountName,
  industry,
  relevantDocuments,
  relevantProjects,
  recommendedDeck,
}: BriefPreDeckPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [fetchedRelevant, setFetchedRelevant] = useState<RelevantContentPayload | null>(null);
  const baseDocuments = mergeDocuments(recommendedDeck, relevantDocuments);
  const baseProjects = mergeProjects(relevantProjects);
  const baseDocumentCount = baseDocuments.length;
  const baseProjectCount = baseProjects.length;

  useEffect(() => {
    setFetchedRelevant(null);
    if (!callId || (baseDocumentCount > 0 && baseProjectCount > 0)) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchRelevantContent(callId);
        if (!cancelled) setFetchedRelevant(payload);
      } catch {
        if (!cancelled) setFetchedRelevant({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseDocumentCount, baseProjectCount, callId]);

  const documents = mergeDocuments(
    recommendedDeck ?? fetchedRelevant?.recommendedDeck,
    [...(relevantDocuments ?? []), ...(fetchedRelevant?.relevantDocuments ?? [])]
  );
  const projects = mergeProjects([
    ...(relevantProjects ?? []),
    ...(fetchedRelevant?.relevantProjects ?? []),
  ]);
  const displayDeck = buildDisplayDeck({ deck, accountName, industry, documents, projects });
  const slides = displayDeck?.slides ?? [];

  async function handleContinueInStudio() {
    if (!callId || !accountName || !displayDeck) return;
    setContinuing(true);
    try {
      const projectId = await createProjectFromPreDeck({
        callId,
        accountName,
        deckTitle: displayDeck.title,
        slides,
        industry,
      });
      router.push(`/content/studio/${projectId}?suggestionId=predeck:${callId}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to open in Studio");
    } finally {
      setContinuing(false);
    }
  }

  if (!displayDeck || slides.length === 0) return null;

  const slideCount = slides.length;

  return (
    <>
      <BriefDetailCard
        tone="main"
        title="AI draft deck"
        icon={Presentation}
        className="h-[min(20.16rem,calc(72vh-7.2rem))]"
        scrollMaxHeight={BRIEF_PARALLEL_CARD_SCROLL_MAX}
        sourceInfo={{
          source: "AI assembly + projects library",
          detail:
            "A call-specific outline using lead research, project-library matches, and supporting KB assets.",
        }}
        headerExtra={
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 rounded-full p-0"
              onClick={() => setOpen(true)}
              aria-label="Preview deck"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {callId && accountName && (
              <Button
                type="button"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                disabled={continuing}
                onClick={() => void handleContinueInStudio()}
              >
                {continuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Studio"}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          <p className="line-clamp-2 text-sm font-normal leading-snug text-foreground/80">
            {displayDeck.summary}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
              <Layers3 className="h-3.5 w-3.5" />
              {slideCount} draft slide{slideCount === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="min-w-0 divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden">
            {slides.slice(0, 4).map((slide, index) => (
              <li key={slide.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="group flex w-full min-w-0 items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="mt-0.5 shrink-0 font-mono type-caption font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold leading-snug text-foreground">
                        {slide.title}
                      </p>
                      <SlideSourceBadge slide={slide} />
                    </div>
                    <p className={cn(briefMainMuted, "mt-1 line-clamp-1")}>{slide.narrative}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </BriefDetailCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(briefDetailDialogClass, "max-w-5xl w-[96vw] h-[90vh] flex flex-col")}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="pr-8 truncate font-bold">{displayDeck.title}</DialogTitle>
            <DialogDescription>
              {slideCount} draft slide{slideCount === 1 ? "" : "s"} assembled for the pre-discovery call.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
            {slides.map((slide, index) => (
              <section
                key={slide.id}
                className="glass-insight-card p-4 flex flex-col"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-2.5">
                  <div className="min-w-0">
                    <p className="type-caption font-medium text-muted-foreground">
                      Slide {index + 1}
                    </p>
                    <h3 className="mt-1 text-base !font-bold leading-tight text-foreground break-words">
                      {slide.title}
                    </h3>
                  </div>
                  <SlideSourceBadge slide={slide} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {slide.narrative}
                </p>
                {hasDistinctPreview(slide) ? (
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="type-label text-muted-foreground">Evidence / notes</p>
                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {slide.previewText}
                    </p>
                  </div>
                ) : null}
                {slide.sourceType === "knowledge_base" && slide.assetId ? (
                  <p className="mt-3 type-caption font-mono text-muted-foreground">
                    KB asset: {slide.assetId}
                  </p>
                ) : slide.sourceType === "project_database" && slide.sourceId ? (
                  <p className="mt-3 type-caption font-mono text-muted-foreground">
                    Project match: {slide.sourceId}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
