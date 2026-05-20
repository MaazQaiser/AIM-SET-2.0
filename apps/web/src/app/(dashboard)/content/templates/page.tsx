"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Code2, Eye, LayoutTemplate, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useContentTemplate,
  useContentTemplates,
  useDeleteTemplate,
} from "@/lib/data/content-studio-hooks";

export default function ContentTemplatesPage() {
  const { data: templates = [] } = useContentTemplates();
  const del = useDeleteTemplate();
  const [viewTemplateId, setViewTemplateId] = useState<string | null>(null);
  const detail = useContentTemplate(viewTemplateId ?? undefined);

  const templateHtml = detail.data?.html ?? "";
  const templateCss = useMemo(() => extractCssFromHtml(templateHtml), [templateHtml]);
  const compiledPreviewHtml = useMemo(() => compileTemplateForPreview(templateHtml), [templateHtml]);

  async function handleDeleteTemplate(templateId: string) {
    const ok = window.confirm("Delete this template? This action cannot be undone.");
    if (!ok) return;
    try {
      await del.mutateAsync(templateId);
    } catch (_err) {
      window.alert("Failed to delete template");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Content Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload PPT, PDF, or images — vision converts each page to reusable HTML/CSS.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/content/studio">Studio</Link>
          </Button>
          <Button asChild>
            <Link href="/content/templates/upload">
              <Upload className="h-4 w-4 mr-1" />
              Upload template
            </Link>
          </Button>
        </div>
      </div>

      {templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4" />
                  {t.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline">{t.artifactType}</Badge>
                  <Badge variant={t.status === "ready" ? "success" : "warning"}>{t.status}</Badge>
                  <Badge variant="secondary">{t.pageCount} pages</Badge>
                </div>
                {t.ingestError && (
                  <p className="text-xs text-destructive">{t.ingestError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={t.status !== "ready"}
                    onClick={() => setViewTemplateId(t.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={del.isPending}
                    onClick={() => void handleDeleteTemplate(t.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates"
          description="Upload a deck or PDF to build your template library."
          action={
            <Button asChild>
              <Link href="/content/templates/upload">Upload template</Link>
            </Button>
          }
        />
      )}

      <Dialog open={Boolean(viewTemplateId)} onOpenChange={(open) => !open && setViewTemplateId(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              {detail.data?.name ?? "Template source"}
            </DialogTitle>
            <DialogDescription>
              Inspect generated template source to verify structure and styles.
            </DialogDescription>
          </DialogHeader>

          {detail.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading template source…</p>
          ) : detail.data ? (
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="css">CSS</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-3">
                {compiledPreviewHtml ? (
                  <div className="h-[70vh] overflow-hidden rounded-md border bg-white">
                    <iframe
                      title="Template preview"
                      srcDoc={compiledPreviewHtml}
                      className="h-full w-full"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No HTML found for this template.</p>
                )}
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
          ) : (
            <p className="text-sm text-destructive">Failed to load template details.</p>
          )}
        </DialogContent>
      </Dialog>
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

  // Handle fenced code blocks returned by LLMs.
  value = value.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!value) return "";

  // Handle JSON payloads where HTML may be nested.
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value) as { html?: string };
      if (typeof parsed.html === "string" && parsed.html.trim()) {
        value = parsed.html.trim();
      }
    } catch {
      // keep original value
    }
  }

  // Handle escaped HTML, e.g. &lt;section&gt;...&lt;/section&gt;.
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
