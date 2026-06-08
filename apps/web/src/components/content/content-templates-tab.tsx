"use client";

import Link from "next/link";
import { CheckCircle2, Code2, Eye, LayoutTemplate, Lock, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { useContentTemplates, useDeleteTemplate, useParentTemplate } from "@/lib/data/content-studio-hooks";
import type { ContentTemplate } from "@/types/content_studio";

function formatArtifactType(value: string) {
  return value.replace(/_/g, " ");
}

export function ContentTemplatesTab() {
  const { data: templates = [], isLoading } = useContentTemplates();
  const { data: parentTemplate, isLoading: parentLoading } = useParentTemplate();
  const isParentConfigured = parentTemplate != null;
  const del = useDeleteTemplate();

  const userTemplates = templates.filter((t) => !t.tags.includes("__parent_template__"));

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

      {isLoading || parentLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* ── Parent Template card — always first ── */}
          <ParentTemplateCard isConfigured={isParentConfigured} />

          {/* ── User templates ── */}
          {userTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              deleting={del.isPending}
              onDelete={() => void handleDeleteTemplate(template.id)}
            />
          ))}

          {userTemplates.length === 0 && (
            <Card className="border-dashed md:col-span-1 xl:col-span-2">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">No templates yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Create a slide skeleton or upload a PPT/PPTX deck.
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
                      Upload
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ParentTemplateCard({ isConfigured }: { isConfigured: boolean }) {
  return (
    <Card
      className={
        isConfigured
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-amber-200 bg-amber-50/60 border-dashed"
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isConfigured ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Lock className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <span className="break-words">Parent Template</span>
          <Badge
            variant="outline"
            className={
              isConfigured
                ? "ml-auto shrink-0 border-emerald-300 text-emerald-700 text-[10px]"
                : "ml-auto shrink-0 border-amber-300 text-amber-700 text-[10px]"
            }
          >
            {isConfigured ? "Configured" : "Not set up"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {isConfigured
            ? "Fixed cover & closing slides applied to every new template automatically."
            : "Define fixed cover & closing slides that are added to every new template."}
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant={isConfigured ? "outline" : "default"}
            className={
              isConfigured
                ? "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                : ""
            }
            asChild
          >
            <Link href="/content/templates/parent">
              {isConfigured ? (
                <>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit parent template
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-1" />
                  Set up parent template
                </>
              )}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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

        {template.tags.filter((t) => !t.startsWith("__")).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags
              .filter((t) => !t.startsWith("__"))
              .slice(0, 4)
              .map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                  {tag}
                </Badge>
              ))}
            {template.tags.filter((t) => !t.startsWith("__")).length > 4 && (
              <Badge variant="outline" className="text-[10px] font-normal">
                +{template.tags.filter((t) => !t.startsWith("__")).length - 4}
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
