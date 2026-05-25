"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2, Eye, LayoutTemplate, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { TemplateDetailDialog } from "@/components/content/template-detail-dialog";
import { useContentTemplates, useDeleteTemplate } from "@/lib/data/content-studio-hooks";

export default function ContentTemplatesPage() {
  const { data: templates = [] } = useContentTemplates();
  const del = useDeleteTemplate();
  const [viewTemplateId, setViewTemplateId] = useState<string | null>(null);

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
          <Button variant="secondary" asChild>
            <Link href="/content/templates/new">
              <Plus className="h-4 w-4 mr-1" />
              New template
            </Link>
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
                {t.ingestError && <p className="text-xs text-destructive">{t.ingestError}</p>}
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
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/content/templates/${t.id}/edit`}>
                      <Code2 className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
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
          description="Create an HTML/CSS template or upload a deck/PDF to build your template library."
          action={{ label: "Create template", href: "/content/templates/new" }}
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
