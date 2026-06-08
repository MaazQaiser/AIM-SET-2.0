"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Code2, Eye, Loader2, Save } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import {
  useContentTemplate,
  useCreateTemplate,
  useUpdateTemplate,
} from "@/lib/data/content-studio-hooks";
import {
  compileTemplateDocument,
  parseTemplateTags,
  splitTemplateDocument,
  STARTER_TEMPLATE_CSS,
  STARTER_TEMPLATE_HTML,
  TEMPLATE_ARTIFACT_TYPES,
  type TemplateArtifactType,
} from "@/lib/content-studio/template-editor";
import type { ContentTemplate, ContentTemplateDraft } from "@/types/content_studio";

interface TemplateEditorProps {
  templateId?: string;
}

export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = Boolean(templateId);
  const detail = useContentTemplate(templateId);
  const create = useCreateTemplate();
  const update = useUpdateTemplate(templateId);

  const cachedTemplate = useMemo(() => {
    if (!templateId) return undefined;
    const list = queryClient.getQueryData<ContentTemplate[]>(["content-templates"]);
    return list?.find((template) => template.id === templateId);
  }, [queryClient, templateId, detail.data, detail.isError]);
  const resolvedTemplate = detail.data ?? cachedTemplate;

  const [name, setName] = useState("New template");
  const [artifactType, setArtifactType] = useState<TemplateArtifactType>("deck");
  const [tagsText, setTagsText] = useState("");
  const [html, setHtml] = useState(STARTER_TEMPLATE_HTML);
  const [css, setCss] = useState(STARTER_TEMPLATE_CSS);
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [previewParts, setPreviewParts] = useState({
    html: STARTER_TEMPLATE_HTML,
    css: STARTER_TEMPLATE_CSS,
  });

  useEffect(() => {
    if (!resolvedTemplate || !isEdit) return;
    const parts = splitTemplateDocument(resolvedTemplate.html ?? "");
    setName(resolvedTemplate.name);
    setArtifactType(resolvedTemplate.artifactType);
    setTagsText(resolvedTemplate.tags.join(", "));
    setHtml(parts.html);
    setCss(parts.css);
  }, [resolvedTemplate, isEdit]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewParts({ html, css });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [css, html]);

  const previewHtml = useMemo(
    () => compileTemplateDocument(previewParts.html, previewParts.css),
    [previewParts.css, previewParts.html]
  );
  const draft = useMemo<ContentTemplateDraft>(
    () => ({
      name,
      artifactType,
      tags: parseTemplateTags(tagsText),
      html,
      css,
    }),
    [artifactType, css, html, name, tagsText]
  );
  const isSaving = create.isPending || update.isPending;

  async function handleSave() {
    setSaveError("");
    if (!name.trim()) {
      setSaveError("Template name is required.");
      return;
    }
    try {
      const saved = isEdit ? await update.mutateAsync(draft) : await create.mutateAsync(draft);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (!isEdit || (isEdit && templateId && saved.id !== templateId)) {
        router.replace(`/content/templates/${saved.id}/edit`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save template");
    }
  }

  if (isEdit && detail.isLoading && !resolvedTemplate) {
    return (
      <div className="p-6">
        <p className="type-body-sm text-muted-foreground">Loading template editor...</p>
      </div>
    );
  }

  if (isEdit && detail.isError && !resolvedTemplate) {
    const message =
      detail.error instanceof Error ? detail.error.message : "Failed to load template";
    return (
      <div className="p-6 space-y-3">
        <p className="type-body-sm text-destructive">{message}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => void detail.refetch()}>
            Retry
          </Button>
          <Link href="/content?tab=templates" className="type-body-sm text-primary underline">
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  if (isEdit && !resolvedTemplate) {
    return (
      <div className="p-6 space-y-3">
        <p className="type-body-sm text-destructive">Template not found.</p>
        <Link href="/content?tab=templates" className="type-body-sm text-primary underline">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-6">
      <div className="sticky top-0 z-30 -mx-6 flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur-md">
        <div className="space-y-1">
          <Link
            href="/content?tab=templates"
            className="flex items-center gap-1 type-body-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Templates
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="type-page-title">
              {isEdit ? "Edit template" : "Create template"}
            </h1>
            <Badge variant="secondary">HTML/CSS</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastSavedAt ? (
            <span className="type-caption text-muted-foreground">Saved {lastSavedAt}</span>
          ) : null}
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save template
          </Button>
        </div>
      </div>

      {detail.isError && resolvedTemplate ? (
        <p className="shrink-0 type-body-sm text-amber-700">
          Showing cached template data. Latest version could not be loaded — save carefully or retry.
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => void detail.refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {saveError ? <p className="shrink-0 type-body-sm text-destructive">{saveError}</p> : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-12">
        <Card className="min-h-0 xl:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Template source
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-4rem)] min-h-0 flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-type">Artifact type</Label>
                <select
                  id="template-type"
                  value={artifactType}
                  onChange={(event) => setArtifactType(event.target.value as TemplateArtifactType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 type-body ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {TEMPLATE_ARTIFACT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-tags">Tags</Label>
              <Input
                id="template-tags"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="enterprise, pitch, dark"
              />
            </div>

            <Tabs defaultValue="html" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="shrink-0">
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="css">CSS</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="min-h-0 flex-1">
                <Textarea
                  value={html}
                  onChange={(event) => setHtml(event.target.value)}
                  spellCheck={false}
                  className="h-full min-h-[320px] resize-none font-mono type-label"
                />
              </TabsContent>
              <TabsContent value="css" className="min-h-0 flex-1">
                <Textarea
                  value={css}
                  onChange={(event) => setCss(event.target.value)}
                  spellCheck={false}
                  className="h-full min-h-[320px] resize-none font-mono type-label"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="min-h-0 xl:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 type-body">
              <Eye className="h-4 w-4" />
              Live preview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] min-h-0">
            <div className="h-full overflow-hidden rounded-md border bg-white">
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                className="h-full w-full"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
