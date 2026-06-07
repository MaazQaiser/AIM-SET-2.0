"use client";

import Link from "next/link";
import { Code2, Eye, LayoutTemplate, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { useContentTemplates, useDeleteTemplate } from "@/lib/data/content-studio-hooks";
import type { ContentTemplate } from "@/types/content_studio";

function formatArtifactType(value: string) {
  return value.replace(/_/g, " ");
}

export function ContentTemplatesTab() {
  const { data: templates = [], isLoading } = useContentTemplates();
  const del = useDeleteTemplate();

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
            Upload PPT or PPTX decks, or build a reusable slide skeleton from scratch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/content/templates/scratch">
              <Plus className="h-4 w-4 mr-1" />
              Create from scratch
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/content/templates/upload">
              <Upload className="h-4 w-4 mr-1" />
              Upload template
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              deleting={del.isPending}
              onDelete={() => void handleDeleteTemplate(template.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Create a slide skeleton or upload a PPT/PPTX deck. Content Studio will recommend templates when drafting new content."
          action={{ label: "Create from scratch", href: "/content/templates/scratch" }}
        />
      )}

    </div>
  );
}

function TemplateCard({
  template,
  deleting,
  onDelete,
}: {
  template: ContentTemplate;
  deleting: boolean;
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
          <Button size="sm" variant="secondary" disabled={template.status !== "ready"} asChild>
            <Link href={`/content/templates/${template.id}/preview`}>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Link>
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
