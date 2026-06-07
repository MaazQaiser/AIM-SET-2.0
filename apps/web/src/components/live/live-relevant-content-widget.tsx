"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FolderKanban, Loader2, Presentation, type LucideIcon } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import {
  useCallRelevantContent,
  useKbAssets,
  useKbProjects,
} from "@/lib/data/hooks";
import { compactText, primarySolution, projectSearchText } from "@/components/knowledge/project-repo-utils";
import { isPresentationFormat, resolveKbFileFormat } from "@/lib/kb/file-format";
import type { CallBrief, RelevantDocument, RelevantProject } from "@/lib/brief-types";
import type { Call, KBAsset, KBProject, TranscriptEvent } from "@/types";

type RelevantContentTab = "projects" | "presentation";

interface LiveRelevantContentWidgetProps {
  callId: string;
  call?: Call | null;
  brief?: CallBrief | null;
  accountName: string;
  leadName?: string;
  keywords: string[];
  transcript: TranscriptEvent[];
}

interface DisplayItem {
  id: string;
  title: string;
  meta: string;
  summary?: string;
  href: string;
  score?: number;
  source: "route" | "kb";
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "around",
  "call",
  "can",
  "for",
  "from",
  "have",
  "into",
  "now",
  "our",
  "right",
  "the",
  "this",
  "what",
  "with",
  "you",
  "your",
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokensFrom(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.flatMap(tokensFrom))].slice(0, 80);
}

function scoreText(text: string, tokens: string[], phrases: string[]): number {
  const haystack = normalize(text);
  if (!haystack) return 0;
  let score = 0;

  for (const phrase of phrases) {
    const normalizedPhrase = normalize(phrase);
    if (normalizedPhrase.length > 2 && haystack.includes(normalizedPhrase)) {
      score += normalizedPhrase.length > 14 ? 8 : 5;
    }
  }

  for (const token of tokens) {
    if (haystack.includes(token)) score += token.length > 6 ? 2 : 1;
  }

  return score;
}

function buildContext({
  call,
  brief,
  accountName,
  leadName,
  keywords,
  transcript,
}: LiveRelevantContentWidgetProps): { tokens: string[]; phrases: string[] } {
  const transcriptContext = transcript
    .slice(-24)
    .map((event) => event.text)
    .join(" ");
  const values = [
    accountName,
    leadName ?? "",
    call?.industry ?? "",
    call?.companyTypeIcp ?? "",
    call?.dealStage ?? "",
    brief?.aiSummary ?? "",
    JSON.stringify(brief?.pains ?? []),
    JSON.stringify(brief?.researchSections ?? []),
    keywords.join(" "),
    transcriptContext,
  ];

  return {
    tokens: uniqueTokens(values),
    phrases: [accountName, leadName ?? "", call?.industry ?? ""].filter(
      (value): value is string => Boolean(value)
    ),
  };
}

function normalizeScore(score?: number): number | undefined {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(1, score));
}

function scoreBadge(score?: number) {
  const normalized = normalizeScore(score);
  if (normalized == null) return null;
  return `${Math.round(normalized * 100)}%`;
}

function routeProjectToDisplay(project: RelevantProject): DisplayItem {
  return {
    id: project.id,
    title: project.title,
    meta:
      project.source === "project_database"
        ? "Project database"
        : project.source === "dc_notes"
          ? "DC notes"
          : "Knowledge base",
    summary: project.summary || project.details,
    href: project.assetId ? `/knowledge/${project.assetId}` : "/knowledge/projects",
    score: normalizeScore(project.relevanceScore),
    source: "route",
  };
}

function routeDocumentToDisplay(document: RelevantDocument): DisplayItem {
  const format = document.format.toUpperCase();
  return {
    id: document.assetId,
    title: document.title,
    meta: document.fileName ? `${format} · ${document.fileName}` : format,
    summary: document.snippet,
    href: `/knowledge/${document.assetId}`,
    score: normalizeScore(document.relevanceScore),
    source: "route",
  };
}

function rankedKbProjects(
  projects: KBProject[],
  tokens: string[],
  phrases: string[]
): DisplayItem[] {
  const scored = projects
    .map((project) => ({
      project,
      score: scoreText(projectSearchText(project), tokens, phrases),
    }))
    .sort((a, b) => b.score - a.score || a.project.title.localeCompare(b.project.title));
  const maxScore = scored[0]?.score ?? 0;

  return scored.slice(0, 5).map(({ project, score }) => ({
    id: project.id,
    title: project.projectName || project.title,
    meta: [project.companyName, project.industry, project.domain].filter(Boolean).join(" · ") || "Project database",
    summary: compactText(primarySolution(project), 145),
    href: `/knowledge/projects/${project.id}`,
    score: maxScore > 0 && score > 0 ? score / maxScore : undefined,
    source: "kb",
  }));
}

function isPresentationAsset(asset: KBAsset): boolean {
  const format = resolveKbFileFormat(asset.fileName, asset.mimeType).format;
  return isPresentationFormat(format);
}

function assetSearchText(asset: KBAsset): string {
  const tags = asset.tags ?? [];
  return [
    asset.title,
    asset.fileName,
    asset.mimeType,
    asset.type,
    tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function rankedPresentationAssets(
  assets: KBAsset[],
  tokens: string[],
  phrases: string[]
): DisplayItem[] {
  const scored = assets
    .filter(isPresentationAsset)
    .map((asset) => ({
      asset,
      score: scoreText(assetSearchText(asset), tokens, phrases),
    }))
    .sort((a, b) => b.score - a.score || a.asset.title.localeCompare(b.asset.title));
  const maxScore = scored[0]?.score ?? 0;

  return scored.slice(0, 5).map(({ asset, score }) => {
    const meta = resolveKbFileFormat(asset.fileName, asset.mimeType);
    const tags = asset.tags ?? [];
    return {
      id: asset.id,
      title: asset.title,
      meta: [
        meta.label,
        asset.previewSlideCount ? `${asset.previewSlideCount} slides` : "",
        asset.fileName,
      ]
        .filter(Boolean)
        .join(" · "),
      summary: tags.length > 0 ? tags.slice(0, 4).join(", ") : undefined,
      href: `/knowledge/${asset.id}`,
      score: maxScore > 0 && score > 0 ? score / maxScore : undefined,
      source: "kb",
    };
  });
}

function dedupeItems(items: DisplayItem[]): DisplayItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.href}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function RelevantItemRow({ item, icon: Icon }: { item: DisplayItem; icon: LucideIcon }) {
  const score = scoreBadge(item.score);

  return (
    <Link
      href={item.href}
      className="group block rounded-md border border-border/70 bg-card/40 px-2.5 py-2 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="truncate type-label text-foreground">{item.title}</p>
            <p className="mt-0.5 truncate type-caption text-muted-foreground">{item.meta}</p>
          </div>
        </div>
        {score && (
          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 type-caption">
            {score}
          </Badge>
        )}
      </div>
      {item.summary && (
        <p className="mt-1 line-clamp-2 type-caption leading-snug text-muted-foreground">
          {item.summary}
        </p>
      )}
    </Link>
  );
}

function RelevantList({
  items,
  tab,
  loading,
}: {
  items: DisplayItem[];
  tab: RelevantContentTab;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 type-caption text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading relevant content…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-3 type-caption text-muted-foreground">
        {tab === "projects"
          ? "No matching projects found yet."
          : "No matching presentations found yet."}
      </p>
    );
  }

  const Icon = tab === "projects" ? FolderKanban : Presentation;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <RelevantItemRow key={`${item.source}:${item.id}`} item={item} icon={Icon} />
      ))}
    </div>
  );
}

export function LiveRelevantContentWidget({
  callId,
  call,
  brief,
  accountName,
  leadName,
  keywords,
  transcript,
}: LiveRelevantContentWidgetProps) {
  const { data: relevantContent, isLoading: loadingRelevant } = useCallRelevantContent(callId);
  const { data: kbProjects = [], isLoading: loadingProjects } = useKbProjects();
  const { data: kbAssets = [], isLoading: loadingAssets } = useKbAssets();

  const context = useMemo(
    () =>
      buildContext({
        callId,
        call,
        brief,
        accountName,
        leadName,
        keywords,
        transcript,
      }),
    [accountName, brief, call, callId, keywords, leadName, transcript]
  );
  const routeProjects = useMemo(
    () => (relevantContent?.relevantProjects ?? []).map(routeProjectToDisplay),
    [relevantContent]
  );
  const routePresentations = useMemo(() => {
    const docs = [
      ...(relevantContent?.recommendedDeck ? [relevantContent.recommendedDeck] : []),
      ...(relevantContent?.relevantDocuments ?? []),
    ].filter((doc) => doc.format === "ppt" || doc.format === "pptx");
    return dedupeItems(docs.map(routeDocumentToDisplay));
  }, [relevantContent]);

  const fallbackProjects = useMemo(
    () => rankedKbProjects(kbProjects, context.tokens, context.phrases),
    [kbProjects, context]
  );
  const fallbackPresentations = useMemo(
    () => rankedPresentationAssets(kbAssets, context.tokens, context.phrases),
    [kbAssets, context]
  );

  const projects = routeProjects.length > 0 ? routeProjects : fallbackProjects;
  const presentations =
    routePresentations.length > 0 ? routePresentations : fallbackPresentations;

  return (
    <Tabs defaultValue="projects" className="flex min-h-0 flex-col">
      <TabsList className="h-8 w-full shrink-0 justify-start rounded-none bg-muted/35 p-1">
        <TabsTrigger value="projects" className="h-6 px-2 type-caption">
          Projects {projects.length > 0 ? projects.length : ""}
        </TabsTrigger>
        <TabsTrigger value="presentation" className="h-6 px-2 type-caption">
          Presentation {presentations.length > 0 ? presentations.length : ""}
        </TabsTrigger>
      </TabsList>
      <div className="max-h-[min(30vh,300px)] overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
        <TabsContent value="projects" className="m-0 focus-visible:outline-none">
          <RelevantList
            items={projects}
            tab="projects"
            loading={projects.length === 0 && (loadingRelevant || loadingProjects)}
          />
        </TabsContent>
        <TabsContent value="presentation" className="m-0 focus-visible:outline-none">
          <RelevantList
            items={presentations}
            tab="presentation"
            loading={presentations.length === 0 && (loadingRelevant || loadingAssets)}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
