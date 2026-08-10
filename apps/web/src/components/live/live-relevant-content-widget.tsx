"use client";

import {
  compactText,
  formatBriefLabel,
  primarySolution,
  projectFieldEntries,
  projectSearchText,
} from "@/components/knowledge/project-repo-utils";
import type { CallBrief } from "@/lib/brief-types";
import { useKbAssets, useKbProjects } from "@/lib/data/hooks";
import { isPresentationFormat, resolveKbFileFormat } from "@/lib/kb/file-format";
import type { Call, KBAsset, KBProject, TranscriptEvent } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Loader2,
  type LucideIcon,
  Move,
  Presentation,
  X,
} from "lucide-react";
import Link from "next/link";
import { type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

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
  details?: string;
  href: string;
  score?: number;
  source: "kb";
  sections?: Array<{ label: string; value: string }>;
  fields?: Array<{ label: string; value: string }>;
  tags?: string[];
  links?: DisplayLink[];
}

interface DisplayLink {
  label: string;
  href: string;
}

interface FloatingPosition {
  x: number;
  y: number;
}

interface FloatingSize {
  width: number;
  height: number;
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFrom(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.flatMap(tokensFrom))].slice(0, 80);
}

interface RankingContext {
  tokens: string[];
  liveTokens: string[];
  phrases: string[];
}

function scoreText(
  text: string,
  tokens: string[],
  phrases: string[],
  liveTokens: string[] = []
): number {
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

  for (const token of liveTokens) {
    if (haystack.includes(token)) score += token.length > 6 ? 5 : 3;
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
}: LiveRelevantContentWidgetProps): RankingContext {
  const transcriptContext = transcript
    .slice(-24)
    .map((event) => event.text)
    .join(" ");
  const customerTranscriptContext = transcript
    .slice(-20)
    .filter((event) => event.speakerRole === "customer")
    .map((event) => event.text)
    .join(" ");
  const transcriptKeywords = transcript
    .slice(-24)
    .flatMap((event) => event.keywords ?? [])
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
    transcriptKeywords,
    transcriptContext,
  ];

  return {
    tokens: uniqueTokens(values),
    liveTokens: uniqueTokens([customerTranscriptContext, transcriptKeywords, keywords.join(" ")]),
    phrases: [accountName, leadName ?? "", call?.industry ?? "", ...keywords.slice(0, 12)].filter(
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

function presentationFullScreenHref(href: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}fullscreen=1`;
}

const URL_MATCH_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const DOMAIN_MATCH_PATTERN =
  /\b(?:[a-z0-9-]+\.)+(?:app|ai|biz|ca|co|com|dev|digital|health|io|net|org|software|solutions|tech|uk|us)(?:\/[^\s<>"'`]+)?/gi;
const LINKISH_FIELD_PATTERN =
  /\b(?:app|demo|definitions?|examples?|link|live|product|prototype|site|url|web|website)\b/i;
const NARRATIVE_PROJECT_FIELD_PATTERN =
  /\b(?:business outcome|company name|description|functional solution|overview|problem statement|project name|solution|summary|technical solution)\b/i;
const TEXT_EMPHASIS_PATTERN =
  /(?:[$€£]\s*)?\b\d[\d,]*(?:\.\d+)?(?:\s*(?:%|k|m|b|days?|weeks?|months?|years?|slides?|users?|employees?|clinics?|locations?|stores?|franchises?|integrations?|modules?|people|ftes?))?\b|\b(?:accommodations?|approval|automation|budget|challenge|compliance|crm|deadlines?|decision|dedicated team|delivery pod|erp|experience|feedback|functional solution|go-live|integrations?|leaves?|missing features?|mobile app|needs?|outcomes?|pain points?|pilots?|platform|polic(?:y|ies)|pos|problem|proof of concept|proposal|poc|results?|roi|scope|security|solution|stakeholders?|technical solution|timeline|uat|user friendly|web app|webapp|workflows?)\b/gi;
const NUMBER_EMPHASIS_PATTERN =
  /^(?:[$€£]\s*)?\d[\d,]*(?:\.\d+)?(?:\s*(?:%|k|m|b|days?|weeks?|months?|years?|slides?|users?|employees?|clinics?|locations?|stores?|franchises?|integrations?|modules?|people|ftes?))?$/i;

function cleanUrlCandidate(value: string): string {
  return value.trim().replace(/[),.;:!?]+$/g, "");
}

function toExternalHref(value?: string | null): string | null {
  const candidate = cleanUrlCandidate(value ?? "");
  if (!candidate) return null;
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostLabel(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "Website";
  }
}

function externalLink(label: string, value?: string | null): DisplayLink | null {
  const href = toExternalHref(value);
  if (!href) return null;
  const cleanLabel = label.trim();
  return { label: cleanLabel || hostLabel(href), href };
}

function dedupeLinks(links: DisplayLink[], limit = 5): DisplayLink[] {
  const seen = new Set<string>();
  const deduped: DisplayLink[] = [];

  for (const link of links) {
    const href = toExternalHref(link.href);
    if (!href) continue;
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...link, href });
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function linksFromText(value?: string | null): DisplayLink[] {
  if (!value) return [];
  const links: DisplayLink[] = [];

  for (const match of value.matchAll(URL_MATCH_PATTERN)) {
    const href = toExternalHref(match[0]);
    if (href) links.push({ label: hostLabel(href), href });
  }

  return dedupeLinks(links);
}

function linksFromField(label: string, value?: string | null): DisplayLink[] {
  if (!value) return [];
  const links = linksFromText(value).map((link) => ({ ...link, label }));
  if (links.length > 0) return dedupeLinks(links);
  if (!LINKISH_FIELD_PATTERN.test(label)) return [];

  const domainLinks: DisplayLink[] = [];
  for (const match of value.matchAll(DOMAIN_MATCH_PATTERN)) {
    const link = externalLink(label, match[0]);
    if (link) domainLinks.push(link);
  }

  const wholeValueLink = externalLink(label, value);
  return dedupeLinks(wholeValueLink ? [wholeValueLink, ...domainLinks] : domainLinks);
}

function projectExternalLinks(project: KBProject): DisplayLink[] {
  const links: DisplayLink[] = [];
  const definitionsLink = externalLink("Definitions", project.definitionsUrl);
  if (definitionsLink) links.push(definitionsLink);

  for (const [key, value] of Object.entries(project.fields ?? {})) {
    links.push(...linksFromField(formatBriefLabel(key), value));
  }

  links.push(
    ...linksFromText(project.summary),
    ...linksFromText(project.problemStatement),
    ...linksFromText(project.businessOutcome),
    ...linksFromText(project.functionalSolution),
    ...linksFromText(project.technicalSolution)
  );

  return dedupeLinks(links);
}

function projectSections(project: KBProject): Array<{ label: string; value: string }> {
  return [
    { label: "Problem", value: project.problemStatement ?? "" },
    { label: "Business outcome", value: project.businessOutcome ?? "" },
    { label: "Functional solution", value: project.functionalSolution ?? "" },
    { label: "Technical solution", value: project.technicalSolution ?? "" },
  ].filter((section) => section.value.trim().length > 0);
}

function projectFields(project: KBProject): Array<{ label: string; value: string }> {
  const fields = [
    { label: "Company", value: project.companyName ?? "" },
    { label: "Industry", value: project.industry ?? "" },
    { label: "Domain", value: project.domain ?? "" },
    { label: "Stage", value: project.companyStage ?? "" },
    { label: "Source", value: project.sourceAssetTitle ?? "" },
    ...projectFieldEntries(project, 12)
      .filter((entry) => !NARRATIVE_PROJECT_FIELD_PATTERN.test(entry.label))
      .filter((entry) => entry.value.trim().length <= 140)
      .map((entry) => ({
        label: entry.label,
        value: entry.value,
      })),
  ].filter((field) => field.value.trim().length > 0);

  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = normalize(`${field.label}:${field.value}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function previewKey(value: string): string {
  return normalize(value).slice(0, 120);
}

function shouldShowSummary(
  summary: string | undefined,
  sections: Array<{ label: string; value: string }>
): summary is string {
  if (!summary?.trim()) return false;
  const key = previewKey(summary);
  if (key.length < 32) return true;
  return !sections.some((section) => normalize(section.value).includes(key));
}

function renderHighlightedText(value: string): ReactNode {
  const matches = [...value.matchAll(TEXT_EMPHASIS_PATTERN)];
  if (matches.length === 0) return value;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of matches) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) parts.push(value.slice(lastIndex, matchIndex));

    if (NUMBER_EMPHASIS_PATTERN.test(matchedText)) {
      parts.push(
        <strong
          key={`number-${matchIndex}-${matchedText}`}
          className="font-semibold tabular-nums text-foreground"
        >
          {matchedText}
        </strong>
      );
    } else {
      parts.push(
        <span
          key={`term-${matchIndex}-${matchedText}`}
          className="font-medium text-foreground underline decoration-foreground/45 underline-offset-2"
        >
          {matchedText}
        </span>
      );
    }

    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts;
}

function rankedKbProjects(
  projects: KBProject[],
  tokens: string[],
  phrases: string[],
  liveTokens: string[]
): DisplayItem[] {
  const scored = projects
    .map((project) => ({
      project,
      score: scoreText(projectSearchText(project), tokens, phrases, liveTokens),
    }))
    .sort((a, b) => b.score - a.score || a.project.title.localeCompare(b.project.title));
  const maxScore = scored[0]?.score ?? 0;

  return scored.slice(0, 5).map(({ project, score }) => {
    const sections = projectSections(project);
    return {
      id: project.id,
      title: project.projectName || project.title,
      meta:
        [project.companyName, project.industry, project.domain].filter(Boolean).join(" · ") ||
        "Project database",
      summary: compactText(primarySolution(project), 180),
      details: sections.length > 0 ? undefined : project.summary,
      href: `/knowledge/projects/${project.id}`,
      score: maxScore > 0 && score > 0 ? score / maxScore : undefined,
      source: "kb",
      sections,
      fields: projectFields(project),
      tags: project.tags,
      links: projectExternalLinks(project),
    };
  });
}

function isPresentationAsset(asset: KBAsset): boolean {
  const format = resolveKbFileFormat(asset.fileName, asset.mimeType).format;
  return isPresentationFormat(format);
}

function assetSearchText(asset: KBAsset): string {
  const tags = asset.tags ?? [];
  return [asset.title, asset.fileName, asset.mimeType, asset.type, tags.join(" ")]
    .filter(Boolean)
    .join(" ");
}

function rankedPresentationAssets(
  assets: KBAsset[],
  tokens: string[],
  phrases: string[],
  liveTokens: string[]
): DisplayItem[] {
  const scored = assets
    .filter(isPresentationAsset)
    .map((asset) => ({
      asset,
      score: scoreText(assetSearchText(asset), tokens, phrases, liveTokens),
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

function RelevantItemRow({
  item,
  icon: Icon,
  tab,
  onProjectClick,
}: {
  item: DisplayItem;
  icon: LucideIcon;
  tab: RelevantContentTab;
  onProjectClick: (item: DisplayItem) => void;
}) {
  const score = scoreBadge(item.score);
  const className =
    "group flex w-full min-w-0 items-start justify-between gap-2 px-1 py-2 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate type-label text-foreground">{item.title}</p>
          <p className="mt-0.5 truncate type-caption text-muted-foreground">{item.meta}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {score && (
          <span className="type-caption font-semibold tabular-nums text-foreground">{score}</span>
        )}
        {tab === "presentation" && (
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>
    </>
  );

  if (tab === "projects") {
    return (
      <button type="button" className={className} onClick={() => onProjectClick(item)}>
        {content}
      </button>
    );
  }

  return (
    <Link
      href={presentationFullScreenHref(item.href)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </Link>
  );
}

function ProjectSmartPopup({
  item,
  items,
  position,
  setPosition,
  size,
  setSize,
  onSelect,
  onClose,
}: {
  item: DisplayItem;
  items: DisplayItem[];
  position: FloatingPosition;
  setPosition: (position: FloatingPosition) => void;
  size: FloatingSize;
  setSize: (size: FloatingSize) => void;
  onSelect: (item: DisplayItem) => void;
  onClose: () => void;
}) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const score = scoreBadge(item.score);
  const currentIndex = Math.max(
    0,
    items.findIndex((candidate) => candidate.id === item.id && candidate.source === item.source)
  );
  const canSwitch = items.length > 1;
  const detailSections = [
    ...(item.details ? [{ label: "Overview", value: item.details }] : []),
    ...(item.sections ?? []),
  ].filter((section) => section.value.trim().length > 0);
  const visibleSummary =
    typeof item.summary === "string" && shouldShowSummary(item.summary, detailSections)
      ? item.summary
      : undefined;
  const liveLinks = item.links ?? [];

  function clampSize(nextWidth: number, nextHeight: number): FloatingSize {
    return {
      width: Math.min(Math.max(320, nextWidth), Math.max(320, window.innerWidth - position.x - 16)),
      height: Math.min(
        Math.max(260, nextHeight),
        Math.max(260, window.innerHeight - position.y - 16)
      ),
    };
  }

  function selectOffset(offset: number) {
    if (!canSwitch) return;
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    const nextItem = items[nextIndex];
    if (nextItem) onSelect(nextItem);
  }

  const onDragStart = (event: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const panelWidth = size.width;
    const panelHeight = size.height;
    const maxX = Math.max(16, window.innerWidth - panelWidth - 16);
    const maxY = Math.max(16, window.innerHeight - panelHeight - 16);
    setPosition({
      x: Math.min(Math.max(16, drag.originX + event.clientX - drag.startX), maxX),
      y: Math.min(Math.max(16, drag.originY + event.clientY - drag.startY), maxY),
    });
  };

  const onDragEnd = (event: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onResizeStart = (event: PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize) return;
    setSize(
      clampSize(
        resize.startWidth + event.clientX - resize.startX,
        resize.startHeight + event.clientY - resize.startY
      )
    );
  };

  const onResizeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <dialog
      open
      className="fixed z-[70] m-0 flex resize flex-col overflow-hidden rounded-lg border border-border bg-popover p-0 text-foreground shadow-2xl"
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
      aria-label={`${item.title} project match`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-move items-center gap-2 text-left text-muted-foreground hover:text-foreground"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          aria-label="Move project popup"
        >
          <Move className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate type-caption font-medium">Smart project match</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => selectOffset(-1)}
            disabled={!canSwitch}
            aria-label="Previous project match"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="min-w-8 text-center type-caption tabular-nums text-muted-foreground">
            {currentIndex + 1}/{Math.max(items.length, 1)}
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => selectOffset(1)}
            disabled={!canSwitch}
            aria-label="Next project match"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close project popup"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="type-body font-semibold leading-snug text-foreground">{item.title}</h3>
            <p className="mt-1 truncate type-caption text-muted-foreground">{item.meta}</p>
          </div>
          {score && (
            <span className="shrink-0 type-caption font-semibold tabular-nums text-foreground">
              {score}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 type-caption font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Open project
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
          {liveLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 type-caption font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ))}
        </div>
        {visibleSummary && (
          <p className="type-caption leading-relaxed text-muted-foreground">
            {renderHighlightedText(visibleSummary)}
          </p>
        )}
        {detailSections.length > 0 && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            {detailSections.map((section) => (
              <section key={section.label} className="space-y-1">
                <p className="type-caption font-semibold text-foreground">{section.label}</p>
                <p className="whitespace-pre-wrap type-caption leading-relaxed text-muted-foreground">
                  {renderHighlightedText(section.value)}
                </p>
              </section>
            ))}
          </div>
        )}
        {item.fields && item.fields.length > 0 && (
          <div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-2">
            {item.fields.map((field) => (
              <div key={`${field.label}:${field.value}`} className="min-w-0">
                <p className="type-caption text-muted-foreground">{field.label}</p>
                <p className="truncate type-caption font-medium text-foreground">
                  {renderHighlightedText(field.value)}
                </p>
              </div>
            ))}
          </div>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
            {item.tags.slice(0, 10).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted/35 px-2 py-0.5 type-caption text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Resize project popup"
        className="absolute bottom-1 right-1 h-5 w-5 cursor-nwse-resize rounded-sm text-muted-foreground/70 hover:bg-muted/70"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      >
        <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b border-r border-current" />
      </button>
    </dialog>
  );
}

function RelevantList({
  items,
  tab,
  loading,
  onProjectClick,
}: {
  items: DisplayItem[];
  tab: RelevantContentTab;
  loading: boolean;
  onProjectClick: (item: DisplayItem) => void;
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
    <div className="divide-y divide-border/60">
      {items.map((item) => (
        <RelevantItemRow
          key={`${item.source}:${item.id}`}
          item={item}
          icon={Icon}
          tab={tab}
          onProjectClick={onProjectClick}
        />
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
  const [selectedProject, setSelectedProject] = useState<DisplayItem | null>(null);
  const [popupPosition, setPopupPosition] = useState<FloatingPosition>({ x: 96, y: 112 });
  const [popupSize, setPopupSize] = useState<FloatingSize>({ width: 430, height: 430 });
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

  const projects = useMemo(
    () => rankedKbProjects(kbProjects, context.tokens, context.phrases, context.liveTokens),
    [kbProjects, context]
  );
  const presentations = useMemo(
    () => rankedPresentationAssets(kbAssets, context.tokens, context.phrases, context.liveTokens),
    [kbAssets, context]
  );

  useEffect(() => {
    if (!selectedProject) return;
    const updatedProject = projects.find(
      (project) => project.id === selectedProject.id && project.source === selectedProject.source
    );
    if (updatedProject && updatedProject !== selectedProject) {
      setSelectedProject(updatedProject);
    }
  }, [projects, selectedProject]);

  return (
    <>
      <Tabs defaultValue="projects" className="flex min-h-0 flex-col">
        <TabsList className="h-8 w-full shrink-0 justify-start rounded-none bg-muted/35 p-1">
          <TabsTrigger value="projects" className="h-6 px-2 type-caption">
            Projects {projects.length > 0 ? projects.length : ""}
          </TabsTrigger>
          <TabsTrigger value="presentation" className="h-6 px-2 type-caption">
            Presentation {presentations.length > 0 ? presentations.length : ""}
          </TabsTrigger>
        </TabsList>
        <div className="max-h-[min(30vh,300px)] overflow-y-auto px-3 py-1 [scrollbar-width:thin]">
          <TabsContent value="projects" className="m-0 focus-visible:outline-none">
            <RelevantList
              items={projects}
              tab="projects"
              loading={projects.length === 0 && loadingProjects}
              onProjectClick={setSelectedProject}
            />
          </TabsContent>
          <TabsContent value="presentation" className="m-0 focus-visible:outline-none">
            <RelevantList
              items={presentations}
              tab="presentation"
              loading={presentations.length === 0 && loadingAssets}
              onProjectClick={setSelectedProject}
            />
          </TabsContent>
        </div>
      </Tabs>
      {selectedProject && (
        <ProjectSmartPopup
          item={selectedProject}
          items={projects}
          position={popupPosition}
          setPosition={setPopupPosition}
          size={popupSize}
          setSize={setPopupSize}
          onSelect={setSelectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </>
  );
}
