"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Code2 } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { TemplateDetailView } from "@/components/content/template-detail-view";
import { useContentTemplate } from "@/lib/data/content-studio-hooks";
import { resolveTemplatePreviewMode } from "@/lib/content-studio/template-preview";

interface TemplatePreviewPageProps {
  templateId: string;
  returnHref?: string;
  pickMode?: boolean;
  selectedTemplateId?: string;
}

export function TemplatePreviewPage({
  templateId,
  returnHref = "/content?tab=templates",
  pickMode = false,
  selectedTemplateId,
}: TemplatePreviewPageProps) {
  const router = useRouter();
  const detail = useContentTemplate(templateId);
  const template = detail.data;
  const sourcePreviewMode = template ? resolveTemplatePreviewMode(template).mode : "html";
  const showSourcePreview = sourcePreviewMode !== "html";

  function handleUseTemplate(id: string) {
    if (pickMode) {
      const separator = returnHref.includes("?") ? "&" : "?";
      router.push(`${returnHref}${separator}pickTemplate=${encodeURIComponent(id)}`);
      return;
    }
    router.push(returnHref);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageShell size="full" className="flex h-[calc(100svh-4rem)] min-h-0 flex-col space-y-4 pb-6">
        <PageHeader className="space-y-3">
          <Link
            href={returnHref}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{template?.name ?? "Template preview"}</h1>
                <Badge variant="secondary">Preview</Badge>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {showSourcePreview
                  ? "Compare the original uploaded file with the generated HTML/CSS version."
                  : "Explore the generated preview, structure, source, and styling for this template."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/content/templates/${templateId}/edit`}>
                  <Code2 className="h-4 w-4" />
                  Edit template
                </Link>
              </Button>
            </div>
          </div>
        </PageHeader>

        <TemplateDetailView
          templateId={templateId}
          className="min-h-0 flex-1"
          onUseTemplate={pickMode ? handleUseTemplate : undefined}
          selectedTemplateId={selectedTemplateId}
        />
      </PageShell>
    </div>
  );
}
