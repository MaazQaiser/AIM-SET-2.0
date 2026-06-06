"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Code2, Eye, LayoutTemplate, Trash2, Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { TemplateDetailDialog } from "@/components/content/template-detail-dialog";
import { useContentTemplates, useDeleteTemplate } from "@/lib/data/content-studio-hooks";
import { TEMPLATE_ARTIFACT_TYPES } from "@/lib/content-studio/template-editor";
import type { ContentTemplate } from "@/types/content_studio";

type TemplateFilter = "all" | ContentTemplate["artifactType"];

function formatArtifactType(value: string) {
  return value.replace(/_/g, " ");
}

export function ContentTemplatesTab() {
  const { data: templates = [], isLoading } = useContentTemplates();
  const del = useDeleteTemplate();
  const [viewTemplateId, setViewTemplateId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TemplateFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    return templates.filter((template) => template.artifactType === filter);
  }, [filter, templates]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Upload PPT or PPTX decks. Content Studio extracts their structure and generated
            HTML/CSS before using them as starting layouts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href="/content/templates/upload">
              <Upload className="h-4 w-4 mr-1" />
              Upload template
            </Link>
          </Button>
        </div>
      </div>

      {templates.length > 0 && (
        <Tabs value={filter} onValueChange={(value) => setFilter(value as TemplateFilter)}>
          <TabsList className="h-9 rounded-lg bg-muted/50 p-1">
            <TabsTrigger value="all" className="text-xs px-3">
              All
              <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {templates.length}
              </span>
            </TabsTrigger>
            {TEMPLATE_ARTIFACT_TYPES.map((type) => {
              const count = templates.filter((t) => t.artifactType === type.value).length;
              if (count === 0) return null;
              return (
                <TabsTrigger key={type.value} value={type.value} className="text-xs px-3">
                  {type.label}
                  <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              deleting={del.isPending}
              onView={() => setViewTemplateId(template.id)}
              onDelete={() => void handleDeleteTemplate(template.id)}
            />
          ))}
        </div>
      ) : templates.length > 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No templates match this filter.
        </p>
      ) : (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Upload a PPT or PPTX deck. Content Studio will extract the design and recommend it when drafting new content."
          action={{ label: "Upload template", href: "/content/templates/upload" }}
        />
      )}

      <TemplateDetailDialog
        templateId={viewTemplateId}
        open={Boolean(viewTemplateId)}
        onOpenChange={(open) => !open && setViewTemplateId(null)}
      />
    </div>
  );
}

function TemplateCard({
  template,
  deleting,
  onView,
  onDelete,
}: {
  template: ContentTemplate;
  deleting: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="break-words">{template.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="capitalize">
            {formatArtifactType(template.artifactType)}
          </Badge>
          <Badge variant={template.status === "ready" ? "success" : "warning"}>{template.status}</Badge>
          <Badge variant="secondary">{template.pageCount} pages</Badge>
        </div>

        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 4 && (
              <Badge variant="outline" className="text-[10px] font-normal">
                +{template.tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {template.sourceFileName ? (
          <p className="truncate text-xs text-muted-foreground" title={template.sourceFileName}>
            Source: {template.sourceFileName}
          </p>
        ) : null}

        {template.ingestError && (
          <p className="text-xs text-destructive">{template.ingestError}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={template.status !== "ready"} onClick={onView}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/content/templates/${template.id}/edit`}>
              <Code2 className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button size="sm" variant="outline" disabled={deleting} onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
