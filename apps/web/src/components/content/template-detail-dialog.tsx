"use client";

import { useMemo } from "react";
import { BookOpen, Check, Code2, FileText, Image, Layers, LayoutTemplate, Palette, Pencil, Table, Type } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { useContentTemplate } from "@/lib/data/content-studio-hooks";
import { resolveTemplatePreviewMode } from "@/lib/content-studio/template-preview";
import { TemplateSourcePreview } from "@/components/content/template-source-preview";
import type { ContentTemplate, ContentTemplateSlideMetadata } from "@/types/content_studio";

interface TemplateDetailDialogProps {
  templateId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate?: (templateId: string) => void;
  selectedTemplateId?: string;
}

export function TemplateDetailDialog({
  templateId,
  open,
  onOpenChange,
  onUseTemplate,
  selectedTemplateId,
}: TemplateDetailDialogProps) {
  const detail = useContentTemplate(templateId ?? undefined);
  const template = detail.data;
  const templateHtml = template?.html ?? "";
  const templateCss = useMemo(() => extractCssFromHtml(templateHtml), [templateHtml]);
  const compiledPreviewHtml = useMemo(
    () => compileTemplateForPreview(templateHtml),
    [templateHtml]
  );
  const cssVariables = Object.entries(template?.cssVariables ?? {});
  const isSelected = Boolean(template?.id && template.id === selectedTemplateId);
  const sourcePreviewMode = template ? resolveTemplatePreviewMode(template).mode : "html";
  const showSourcePreview = sourcePreviewMode !== "html";
  const showGeneratedPreviewTab = showSourcePreview;
  const showCodeTabs = showSourcePreview || Boolean(templateHtml);

  function handleUseTemplate() {
    if (!template?.id || !onUseTemplate) return;
    onUseTemplate(template.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            {template?.name ?? "Template details"}
          </DialogTitle>
          <DialogDescription>
            {showSourcePreview
              ? "Compare the original uploaded file with the generated HTML/CSS version before using this template."
              : "Explore the generated preview, structure, source, and styling before using this template."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {detail.isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading template details…</p>
          ) : template ? (
            <div className="space-y-4">
              <TemplateMetadata
                template={template}
                cssVariableCount={cssVariables.length}
                showSourceFile={showSourcePreview}
              />

              <Tabs defaultValue="preview">
                <TabsList>
                  <TabsTrigger value="preview">
                    {showSourcePreview ? "Original preview" : "Generated preview"}
                  </TabsTrigger>
                  {showGeneratedPreviewTab ? (
                    <TabsTrigger value="generated">Generated preview</TabsTrigger>
                  ) : null}
                  <TabsTrigger value="details">Details</TabsTrigger>
                  {showCodeTabs ? (
                    <>
                      <TabsTrigger value="html">HTML</TabsTrigger>
                      <TabsTrigger value="css">CSS</TabsTrigger>
                    </>
                  ) : null}
                </TabsList>
                <TabsContent value="preview" className="mt-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0">
                      {showSourcePreview ? (
                        <TemplateSourcePreview template={template} />
                      ) : compiledPreviewHtml ? (
                        <div className="h-[62vh] overflow-hidden rounded-md border bg-neutral-900">
                          <iframe
                            title="Template preview"
                            srcDoc={compiledPreviewHtml}
                            className="h-full w-full"
                            sandbox="allow-same-origin allow-scripts"
                          />
                        </div>
                      ) : template.thumbnailUrl ? (
                        <div className="h-[62vh] overflow-auto rounded-md border bg-white p-4">
                          <img
                            src={template.thumbnailUrl}
                            alt=""
                            className="mx-auto max-h-full max-w-full rounded border object-contain"
                          />
                        </div>
                      ) : (
                        <p className="rounded-md border p-4 text-sm text-muted-foreground">
                          No preview available for this template.
                        </p>
                      )}
                    </div>
                    <TemplateUnderstandingPanel template={template} compact />
                  </div>
                </TabsContent>
                {showGeneratedPreviewTab ? (
                  <TabsContent value="generated" className="mt-3">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
                      <GeneratedTemplatePreview
                        html={compiledPreviewHtml}
                        ingestError={template.ingestError}
                      />
                      <TemplateUnderstandingPanel template={template} compact />
                    </div>
                  </TabsContent>
                ) : null}
                <TabsContent value="details" className="mt-3">
                  <div className="space-y-3">
                    <TemplateUnderstandingPanel template={template} />
                    <TemplateVariableList variables={cssVariables} />
                    {template.sourceFileName ? (
                      <p className="text-xs text-muted-foreground">
                        Source file: <span className="font-medium text-foreground">{template.sourceFileName}</span>
                      </p>
                    ) : null}
                  </div>
                </TabsContent>
                {showCodeTabs ? (
                  <>
                    <TabsContent value="html" className="mt-3">
                      <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap break-all">
                        {templateHtml || "No HTML found for this template."}
                      </pre>
                    </TabsContent>
                    <TabsContent value="css" className="mt-3">
                      <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap break-all">
                        {templateCss || "No <style> CSS block found in this template HTML."}
                      </pre>
                    </TabsContent>
                  </>
                ) : null}
              </Tabs>
            </div>
          ) : (
            <p className="py-8 text-sm text-destructive">Failed to load template details.</p>
          )}
        </div>

        {onUseTemplate && template && (
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button type="button" onClick={handleUseTemplate} disabled={isSelected}>
              {isSelected ? (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Selected
                </>
              ) : (
                <>
                  <LayoutTemplate className="mr-1 h-4 w-4" />
                  Use template
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateMetadata({
  template,
  cssVariableCount,
  showSourceFile = false,
}: {
  template: ContentTemplate;
  cssVariableCount: number;
  showSourceFile?: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{template.artifactType}</Badge>
          <Badge variant={template.status === "ready" ? "success" : "warning"}>
            {template.status}
          </Badge>
          <Badge variant="secondary">{template.pageCount} pages</Badge>
          {!showSourceFile && (
            <Badge variant="secondary">{cssVariableCount} variables</Badge>
          )}
          {template.sourceFileName ? (
            <Badge variant="outline">{template.sourceFileName}</Badge>
          ) : null}
        </div>
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {template.ingestError && <p className="text-sm text-destructive">{template.ingestError}</p>}
      </div>
      <div className="text-xs text-muted-foreground md:text-right">
        <p>Created</p>
        <p className="font-medium text-foreground">{formatDate(template.createdAt)}</p>
      </div>
    </div>
  );
}

function GeneratedTemplatePreview({
  html,
  ingestError,
}: {
  html: string;
  ingestError?: string;
}) {
  if (!html) {
    return (
      <div className="flex h-[62vh] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/10 p-6 text-center">
        <Code2 className="h-6 w-6 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Generated HTML/CSS preview is not available yet.</p>
          <p className="max-w-md text-xs leading-5 text-muted-foreground">
            The original file preview is still available. Re-upload or reprocess the template once
            the conversion agent is ready to create the generated HTML/CSS version.
          </p>
        </div>
        {ingestError ? (
          <p className="max-w-md rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {ingestError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-[62vh] overflow-hidden rounded-md border bg-neutral-900">
      <iframe
        title="Generated HTML/CSS template preview"
        srcDoc={html}
        className="h-full w-full"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}

function TemplateUnderstandingPanel({
  template,
  compact = false,
}: {
  template: ContentTemplate;
  compact?: boolean;
}) {
  const metadata = template.metadata ?? {};
  const slides = metadata.slides ?? [];
  const slideCount = metadata.slideCount ?? template.previewSlideCount ?? template.pageCount;
  const design = metadata.design ?? {};
  const conversion = metadata.conversion ?? {};
  const visibleSlides = compact ? slides.slice(0, 5) : slides;
  const hasUnderstanding =
    slides.length > 0 ||
    Boolean(design.colors?.length) ||
    Boolean(design.fonts?.length) ||
    Boolean(design.layouts?.length) ||
    Boolean(conversion.htmlGenerated || conversion.error);

  return (
    <div
      className={
        compact
          ? "flex h-[62vh] flex-col gap-0 overflow-hidden rounded-md border bg-background"
          : "rounded-md border bg-background"
      }
    >
      {/* ── header ── */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b px-3 py-2.5">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Deck understanding
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {slideCount} {slideCount === 1 ? "slide" : "slides"}
            {metadata.source?.extension ? ` · ${metadata.source.extension.toUpperCase()}` : ""}
          </p>
        </div>
        <Badge variant={conversion.htmlGenerated ? "success" : "outline"} className="shrink-0">
          {conversion.htmlGenerated ? "HTML ready" : "Source read"}
        </Badge>
      </div>

      {!hasUnderstanding ? (
        <p className="p-3 text-sm text-muted-foreground">
          Slide structure has not been extracted for this template yet.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── errors / notes ── */}
          {(metadata.sourceFormatNote || metadata.extractionError) ? (
            <div className="space-y-1.5 border-b px-3 py-2">
              {metadata.sourceFormatNote ? (
                <p className="rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                  {metadata.sourceFormatNote}
                </p>
              ) : null}
              {metadata.extractionError ? (
                <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {metadata.extractionError}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ── overall deck summary ── */}
          <DeckOverallSummary design={design} slides={slides} slideCount={Number(slideCount)} conversion={conversion ?? {}} />

          {/* ── slide-by-slide ── */}
          {visibleSlides.length > 0 ? (
            <div className="px-3 pb-3">
              <p className="mb-2 flex items-center gap-1.5 pt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <FileText className="h-3 w-3" />
                Slide breakdown
              </p>
              <div className="space-y-2">
                {visibleSlides.map((slide) => (
                  <SlideUnderstandingCard key={slide.slide} slide={slide} />
                ))}
              </div>
              {compact && slides.length > visibleSlides.length ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  +{slides.length - visibleSlides.length} more slides — see Details tab
                </p>
              ) : null}
            </div>
          ) : (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No slide text was found in the source file.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DeckOverallSummary({
  design,
  slides,
  slideCount,
  conversion,
}: {
  design: NonNullable<ContentTemplate["metadata"]>["design"];
  slides: ContentTemplateSlideMetadata[];
  slideCount: number;
  conversion: NonNullable<NonNullable<ContentTemplate["metadata"]>["conversion"]>;
}) {
  const colors = design?.colors ?? [];
  const fonts = design?.fonts ?? [];
  const layouts = design?.layouts ?? [];

  // Derive a short purpose sentence from layout names
  const purposeHints: string[] = [];
  const layoutStr = layouts.join(" ").toLowerCase();
  if (layoutStr.includes("cover") || layoutStr.includes("title")) purposeHints.push("cover slide");
  if (layoutStr.includes("content") || layoutStr.includes("body")) purposeHints.push("content slides");
  if (layoutStr.includes("blank")) purposeHints.push("blank layouts");
  if (layoutStr.includes("section")) purposeHints.push("section dividers");
  if (layoutStr.includes("comparison") || layoutStr.includes("two")) purposeHints.push("comparison layouts");
  if (layoutStr.includes("chart") || layoutStr.includes("table")) purposeHints.push("data slides");
  const totalImages = slides.reduce((s, sl) => s + (sl.imageCount ?? 0), 0);
  const totalCharts = slides.reduce((s, sl) => s + (sl.chartCount ?? 0), 0);
  const totalTables = slides.reduce((s, sl) => s + (sl.tableCount ?? 0), 0);

  if (!colors.length && !fonts.length && !layouts.length) return null;

  return (
    <div className="space-y-3 border-b px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Overall
      </p>

      {/* palette */}
      {colors.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Palette</span>
          <div className="flex flex-wrap gap-1">
            {colors.slice(0, 10).map((color) => (
              <span
                key={color}
                className="h-5 w-5 rounded-full border shadow-sm"
                style={isCssColor(color) ? { backgroundColor: color } : undefined}
                title={color}
                aria-label={color}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* fonts */}
      {fonts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Fonts</span>
          {fonts.slice(0, 5).map((font) => (
            <Badge key={font} variant="outline" className="text-[10px] font-normal">
              {font}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* layouts */}
      {layouts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Layouts</span>
          {layouts.slice(0, 6).map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px] font-normal">
              {l}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* asset counts */}
      {(totalImages > 0 || totalCharts > 0 || totalTables > 0) ? (
        <div className="flex flex-wrap gap-2">
          {totalImages > 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Image className="h-3.5 w-3.5" />
              {totalImages} {totalImages === 1 ? "image" : "images"}
            </span>
          ) : null}
          {totalCharts > 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              {totalCharts} {totalCharts === 1 ? "chart" : "charts"}
            </span>
          ) : null}
          {totalTables > 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Table className="h-3.5 w-3.5" />
              {totalTables} {totalTables === 1 ? "table" : "tables"}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* inferred purpose */}
      {purposeHints.length > 0 ? (
        <p className="rounded bg-muted/30 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
          {slideCount}-slide deck including {purposeHints.join(", ")}.
          {conversion.htmlGenerated ? " HTML/CSS generated." : ""}
        </p>
      ) : null}

      {/* content slots */}
      {conversion.slots && conversion.slots.length > 0 ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
            Content slots
            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
              {conversion.slots.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-1">
            {conversion.slots.map((slot) => (
              <span
                key={slot.id}
                title={slot.id}
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  slot.type === "image"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-primary/8 text-primary"
                }`}
              >
                {slot.type === "image" ? <Image className="h-2.5 w-2.5" /> : <Pencil className="h-2.5 w-2.5" />}
                {slot.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlideUnderstandingCard({ slide }: { slide: ContentTemplateSlideMetadata }) {
  const colors = slide.colors ?? [];
  const fonts = slide.fonts ?? [];

  // Derive a role label from the layout name
  const layout = (slide.layout ?? "").toLowerCase();
  let roleLabel = "";
  if (layout.includes("cover") || layout.includes("title slide")) roleLabel = "Cover";
  else if (layout.includes("section")) roleLabel = "Section";
  else if (layout.includes("blank")) roleLabel = "Blank";
  else if (layout.includes("comparison") || layout.includes("two content")) roleLabel = "Comparison";
  else if (layout.includes("content") || layout.includes("body")) roleLabel = "Content";
  else if (layout.includes("picture") || layout.includes("image")) roleLabel = "Visual";
  else if (layout.includes("table")) roleLabel = "Table";
  else if (layout.includes("chart")) roleLabel = "Chart";
  else if (slide.imageCount && slide.imageCount > 0 && !slide.text) roleLabel = "Visual";
  else if (slide.slide === 1) roleLabel = "Cover";

  // Truncate text snippet
  const snippet = (slide.text ?? "").slice(0, 120).trim();

  return (
    <div className="rounded-md border bg-muted/10 p-2.5">
      <div className="flex items-start gap-2">
        {/* slide number bubble */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums">
          {slide.slide}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="truncate text-xs font-medium leading-tight">
              {slide.title || slide.name || `Slide ${slide.slide}`}
            </p>
            {roleLabel ? (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide">
                {roleLabel}
              </Badge>
            ) : null}
          </div>

          {/* text snippet */}
          {snippet && snippet.toLowerCase() !== (slide.title ?? "").toLowerCase() ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
              {snippet}
            </p>
          ) : null}

          {/* per-slide design bits */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {colors.slice(0, 5).map((color) => (
              <span
                key={color}
                className="h-3.5 w-3.5 rounded-full border"
                style={isCssColor(color) ? { backgroundColor: color } : undefined}
                title={color}
                aria-label={color}
              />
            ))}
            {fonts.slice(0, 2).map((font) => (
              <Badge key={font} variant="outline" className="px-1 py-0 text-[9px] font-normal">
                {font}
              </Badge>
            ))}
            {slide.imageCount ? (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Image className="h-3 w-3" />
                {slide.imageCount}
              </span>
            ) : null}
            {slide.tableCount ? (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Table className="h-3 w-3" />
                {slide.tableCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateVariableList({ variables }: { variables: Array<[string, string]> }) {
  if (variables.length === 0) {
    return (
      <p className="rounded-md border p-4 text-sm text-muted-foreground">
        No CSS variables were extracted for this template.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {variables.map(([name, value]) => (
        <div key={name} className="flex min-w-0 items-center gap-3 rounded-md border p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
            {isCssColor(value) ? (
              <span
                className="h-6 w-6 rounded border"
                style={{ backgroundColor: value }}
                aria-hidden="true"
              />
            ) : (
              <Palette className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function extractCssFromHtml(html: string): string {
  if (!html) return "";
  const matches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  if (!matches.length) return "";
  return matches
    .map((m) => (m[1] ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function compileTemplateForPreview(rawHtml: string): string {
  const normalized = normalizeTemplateHtml(rawHtml);
  if (!normalized) return "";
  // Already a full document — return as-is; the backend sets the correct viewport meta.
  if (/<!doctype html>|<html[\s>]/i.test(normalized)) return normalized;

  // Partial HTML (bare <section> snippets): wrap with a proper shell that
  // matches the backend's _merge_template_html output styling.
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=1280, initial-scale=1" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />',
    "<style>",
    "*, *::before, *::after { box-sizing: border-box; }",
    "html, body { margin: 0; padding: 0; background: #1c1c1e; }",
    "section.slide { display: block; position: relative; width: 1280px; height: 720px; overflow: hidden; margin: 0 auto; font-family: 'Urbanist', Arial, sans-serif; }",
    ".placeholder { display: block; }",
    "</style>",
    "</head>",
    `<body>${normalized}</body>`,
    "</html>",
  ].join("");
}

function normalizeTemplateHtml(rawHtml: string): string {
  let value = rawHtml?.trim() ?? "";
  if (!value) return "";

  value = value
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!value) return "";

  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value) as { html?: string };
      if (typeof parsed.html === "string" && parsed.html.trim()) {
        value = parsed.html.trim();
      }
    } catch {
      // Keep the original value.
    }
  }

  if (!value.includes("<") && /&lt;|&gt;|&amp;/.test(value)) {
    value = value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  return value.trim();
}

function isCssColor(value: string): boolean {
  const trimmed = value.trim();
  return /^#[0-9a-f]{3,8}$/i.test(trimmed) || /^(rgb|hsl)a?\(/i.test(trimmed);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
