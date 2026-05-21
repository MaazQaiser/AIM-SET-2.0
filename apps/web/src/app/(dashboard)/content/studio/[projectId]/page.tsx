"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudioChat } from "@/components/content/studio-chat";
import { StudioPreview } from "@/components/content/studio-preview";
import { TemplatePicker } from "@/components/content/template-picker";
import {
  useContentTemplates,
  useStudioExport,
  useStudioMessage,
  useStudioProject,
} from "@/lib/data/content-studio-hooks";
import type { StudioTurnResult } from "@/types/content_studio";

export default function StudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data, refetch } = useStudioProject(projectId);
  const project = data?.project;
  const templates = useContentTemplates(project?.artifactType);
  const exportMut = useStudioExport(projectId);
  const generateMut = useStudioMessage(projectId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [previewHtml, setPreviewHtml] = useState<string | undefined>();

  const latestHtml = previewHtml ?? data?.latestRevision?.html;
  const revisionId = data?.latestRevision?.id;

  function onTurn(result: StudioTurnResult) {
    if (result.html) setPreviewHtml(result.html);
    if (result.recommended_templates?.length) {
      const first = result.recommended_templates[0]?.template_id;
      if (first) setSelectedTemplateId(first);
    }
    void refetch();
  }

  async function handleExport(fmt: "pdf" | "png" | "pptx") {
    if (!revisionId) {
      window.alert("Generate a preview first.");
      return;
    }
    const out = await exportMut.mutateAsync({ revisionId, format: fmt });
    if (out.downloadUrl) window.open(out.downloadUrl, "_blank");
    else window.alert("Export ready (download URL unavailable in offline mode).");
  }

  async function handleGenerateSlides() {
    const envelope = await generateMut.mutateAsync({
      message:
        "Generate the slides now using gathered requirements and sensible defaults for any missing details. Do not ask follow-up questions unless generation is impossible.",
      templateId: selectedTemplateId ?? project?.templateId ?? undefined,
      generate: true,
    });
    onTurn(envelope.result);
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading studio project…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 h-[calc(100vh-4rem)] flex flex-col">
      <Link
        href="/content/studio"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
        Studio
      </Link>

      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold">{project.title}</h1>
          <p className="text-xs text-muted-foreground capitalize">
            {project.artifactType} · ${project.costUsd.toFixed(2)} spent · cap $1.50
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={generateMut.isPending}
            onClick={() => void handleGenerateSlides()}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {generateMut.isPending ? "Generating..." : "Generate slides"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!revisionId || exportMut.isPending}
            onClick={() => void handleExport("pdf")}
          >
            <Download className="h-3 w-3 mr-1" />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!revisionId || exportMut.isPending}
            onClick={() => void handleExport("png")}
          >
            PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!revisionId || exportMut.isPending}
            onClick={() => void handleExport("pptx")}
          >
            PPTX
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-4 min-h-0 flex flex-col">
          <StudioChat
            projectId={projectId}
            messages={data?.messages ?? []}
            onTurn={onTurn}
            selectedTemplateId={selectedTemplateId ?? project.templateId ?? undefined}
          />
        </div>
        <div className="lg:col-span-5 min-h-0">
          <StudioPreview html={latestHtml} />
        </div>
        <div className="lg:col-span-3 space-y-4 overflow-y-auto">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplatePicker
                templates={templates.data ?? []}
                recommendedIds={project.recommendedTemplateIds}
                selectedId={selectedTemplateId ?? project.templateId ?? undefined}
                onSelect={setSelectedTemplateId}
              />
            </CardContent>
          </Card>
          {data?.revisions && data.revisions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.revisions.map((r) => (
                  <p key={r.id} className="text-xs text-muted-foreground">
                    {r.createdAt}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
