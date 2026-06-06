"use client";

import { useMemo } from "react";
import { Check, Code2, FileText, Layers, LayoutTemplate, Palette, Type } from "lucide-react";
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
                        <div className="h-[62vh] overflow-hidden rounded-md border bg-white">
                          <iframe
                            title="Template preview"
                            srcDoc={compiledPreviewHtml}
                            className="h-full w-full"
                            sandbox="allow-same-origin"
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
    <div className="h-[62vh] overflow-hidden rounded-md border bg-white">
      <iframe
        title="Generated HTML/CSS template preview"
        srcDoc={html}
        className="h-full w-full"
        sandbox="allow-same-origin"
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
  const visibleSlides = compact ? slides.slice(0, 6) : slides;
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
          ? "h-[62vh] overflow-auto rounded-md border bg-background p-3"
          : "rounded-md border bg-background p-3"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Deck understanding
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {slideCount} {slideCount === 1 ? "slide" : "slides"}
            {metadata.source?.extension ? ` / ${metadata.source.extension.toUpperCase()}` : ""}
          </p>
        </div>
        <Badge variant={conversion.htmlGenerated ? "success" : "outline"}>
          {conversion.htmlGenerated ? "HTML ready" : "Source read"}
        </Badge>
      </div>

      {!hasUnderstanding ? (
        <p className="mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Slide structure has not been extracted for this template yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {metadata.sourceFormatNote ? (
            <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              {metadata.sourceFormatNote}
            </p>
          ) : null}
          {metadata.extractionError ? (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {metadata.extractionError}
            </p>
          ) : null}

          <TemplateDesignSummary design={design} />

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Slides
            </div>
            {visibleSlides.length > 0 ? (
              visibleSlides.map((slide) => (
                <div key={slide.slide} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {slide.slide}
                    </Badge>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {slide.title || slide.name || `Slide ${slide.slide}`}
                      </p>
                      {slide.layout ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">Layout: {slide.layout}</p>
                      ) : null}
                    </div>
                  </div>
                  {slide.text ? (
                    <p className="max-h-20 overflow-hidden text-xs leading-5 text-muted-foreground">
                      {slide.text}
                    </p>
                  ) : null}
                  <SlideDesignBits slide={slide} />
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No slide text was found in the source file.
              </p>
            )}
            {compact && slides.length > visibleSlides.length ? (
              <p className="text-xs text-muted-foreground">
                +{slides.length - visibleSlides.length} more slides in Details
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateDesignSummary({
  design,
}: {
  design: NonNullable<ContentTemplate["metadata"]>["design"];
}) {
  const colors = design?.colors ?? [];
  const fonts = design?.fonts ?? [];
  const layouts = design?.layouts ?? [];
  if (!colors.length && !fonts.length && !layouts.length) return null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      {colors.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Palette className="h-3.5 w-3.5" />
            Colors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((color) => (
              <span
                key={color}
                className="h-6 w-6 rounded border"
                style={isCssColor(color) ? { backgroundColor: color } : undefined}
                title={color}
                aria-label={color}
              />
            ))}
          </div>
        </div>
      ) : null}
      {fonts.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Type className="h-3.5 w-3.5" />
            Fonts
          </p>
          <div className="flex flex-wrap gap-1">
            {fonts.slice(0, 8).map((font) => (
              <Badge key={font} variant="outline" className="font-normal">
                {font}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {layouts.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Layouts</p>
          <div className="flex flex-wrap gap-1">
            {layouts.slice(0, 8).map((layout) => (
              <Badge key={layout} variant="outline" className="font-normal">
                {layout}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlideDesignBits({
  slide,
}: {
  slide: ContentTemplateSlideMetadata;
}) {
  const colors = slide.colors ?? [];
  const fonts = slide.fonts ?? [];
  const stats = [
    slide.imageCount ? `${slide.imageCount} images` : "",
    slide.tableCount ? `${slide.tableCount} tables` : "",
    slide.chartCount ? `${slide.chartCount} charts` : "",
  ].filter(Boolean);

  if (!colors.length && !fonts.length && !stats.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.slice(0, 6).map((color) => (
        <span
          key={color}
          className="h-4 w-4 rounded border"
          style={isCssColor(color) ? { backgroundColor: color } : undefined}
          title={color}
          aria-label={color}
        />
      ))}
      {fonts.slice(0, 3).map((font) => (
        <Badge key={font} variant="outline" className="text-[10px] font-normal">
          {font}
        </Badge>
      ))}
      {stats.map((stat) => (
        <Badge key={stat} variant="secondary" className="text-[10px] font-normal">
          {stat}
        </Badge>
      ))}
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
  if (/<!doctype html>|<html[\s>]/i.test(normalized)) return normalized;

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    "<style>",
    "html, body { margin: 0; padding: 0; background: #fff; }",
    "body { min-height: 100vh; }",
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
