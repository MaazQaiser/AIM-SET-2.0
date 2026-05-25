"use client";

import { useMemo } from "react";
import { Check, Code2, LayoutTemplate, Palette } from "lucide-react";
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
import type { ContentTemplate } from "@/types/content_studio";

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
            Explore the generated preview, structure, source, and styling before using this
            template.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {detail.isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading template details…</p>
          ) : template ? (
            <div className="space-y-4">
              <TemplateMetadata template={template} cssVariableCount={cssVariables.length} />

              <Tabs defaultValue="preview">
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="css">CSS</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-3">
                  {compiledPreviewHtml ? (
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
                      No HTML or thumbnail found for this template.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="details" className="mt-3">
                  <TemplateVariableList variables={cssVariables} />
                </TabsContent>
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
}: {
  template: ContentTemplate;
  cssVariableCount: number;
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
          <Badge variant="secondary">{cssVariableCount} variables</Badge>
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
