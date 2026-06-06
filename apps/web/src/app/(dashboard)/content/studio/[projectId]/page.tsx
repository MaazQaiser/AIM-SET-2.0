"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, ChevronLeft, Download, Eye, Plus, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { StudioChat } from "@/components/content/studio-chat";
import { StudioPreview } from "@/components/content/studio-preview";
import { TemplatePicker } from "@/components/content/template-picker";
import {
  useContentTemplates,
  useRestoreStudioRevision,
  useSaveRevisionToKb,
  useStudioRevision,
  useStudioExport,
  useStudioMessage,
  useStudioProject,
} from "@/lib/data/content-studio-hooks";
import type { StudioKbSaveFormat, StudioTurnResult } from "@/types/content_studio";

export default function StudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data, refetch } = useStudioProject(projectId);
  const project = data?.project;
  const templates = useContentTemplates(project?.artifactType);
  const exportMut = useStudioExport(projectId);
  const generateMut = useStudioMessage(projectId);
  const restoreMut = useRestoreStudioRevision(projectId);
  const saveToKbMut = useSaveRevisionToKb(projectId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [previewHtml, setPreviewHtml] = useState<string | undefined>();
  const [previewRevisionId, setPreviewRevisionId] = useState<string | undefined>();
  const [actionMessage, setActionMessage] = useState<string>("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTags, setSaveTags] = useState("generated, content-studio");
  const [saveFormat, setSaveFormat] = useState<StudioKbSaveFormat>("pdf");
  const previewRevision = useStudioRevision(projectId, previewRevisionId);

  const latestHtml = previewHtml ?? data?.latestRevision?.html;
  const revisionId = previewRevisionId ?? data?.latestRevision?.id;
  const artifactLabel =
    project?.artifactType === "one_pager"
      ? "one-pager"
      : project?.artifactType === "image"
        ? "image"
        : "deck";

  function onTurn(result: StudioTurnResult) {
    setPreviewRevisionId(undefined);
    setActionMessage("");
    if (result.html) {
      setPreviewHtml(result.html);
      setActionMessage("Draft is ready. Save it to KB when you want it reused across the platform.");
    }
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
    setActionMessage(`Exporting ${fmt.toUpperCase()}...`);
    const out = await exportMut.mutateAsync({ revisionId, format: fmt });
    setActionMessage(`Exported ${fmt.toUpperCase()}.`);
    if (out.downloadUrl) window.open(out.downloadUrl, "_blank");
    else window.alert("Export ready (download URL unavailable in offline mode).");
  }

  async function handleRestore(revId: string) {
    setActionMessage("Restoring version...");
    const restored = await restoreMut.mutateAsync(revId);
    setPreviewRevisionId(undefined);
    setPreviewHtml(restored.revision.html);
    setActionMessage("Version restored as the latest draft.");
    void refetch();
  }

  async function handleSaveToKb() {
    if (!revisionId) {
      window.alert("Generate a preview first.");
      return;
    }
    const title = saveTitle.trim() || project?.title || "Generated Studio Asset";
    const tags = saveTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setActionMessage(`Saving ${saveFormat.toUpperCase()} to KB...`);
    const result = await saveToKbMut.mutateAsync({
      revisionId,
      title,
      tags,
      format: saveFormat,
    });
    setSaveDialogOpen(false);
    setActionMessage(`Saved ${result.format?.toUpperCase() ?? saveFormat.toUpperCase()} to KB as ${result.asset.title}.`);
  }

  function openSaveDialog() {
    if (!revisionId) {
      window.alert("Generate a preview first.");
      return;
    }
    setSaveTitle(project?.title ?? "Generated Studio Asset");
    setSaveTags("generated, content-studio");
    setSaveFormat(project?.artifactType === "deck" ? "pptx" : "pdf");
    setSaveDialogOpen(true);
  }

  async function handleGenerateSlides() {
    const envelope = await generateMut.mutateAsync({
      message: `Generate the ${artifactLabel} now using gathered requirements and sensible defaults for any missing details. Do not ask follow-up questions unless generation is impossible.`,
      templateId: selectedTemplateId ?? project?.templateId ?? undefined,
      generate: true,
    });
    onTurn(envelope.result);
  }

  useEffect(() => {
    const html = previewRevision.data?.html;
    if (!html) return;
    setPreviewHtml(html);
    setActionMessage("Previewing an older version. Restore it to make it current.");
  }, [previewRevision.data?.html]);

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
            {generateMut.isPending ? "Generating..." : `Generate ${artifactLabel}`}
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
          <Button
            size="sm"
            variant="outline"
            disabled={!revisionId || saveToKbMut.isPending}
            onClick={openSaveDialog}
          >
            <BookOpenCheck className="h-3 w-3 mr-1" />
            Save to KB
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {actionMessage}
        </div>
      )}

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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Templates</CardTitle>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/content/templates/new">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    New
                  </Link>
                </Button>
              </div>
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
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/70 p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {r.id === data.latestRevision?.id ? "Latest version" : "Saved version"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{r.createdAt}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant={previewRevisionId === r.id ? "secondary" : "ghost"}
                        className="h-7 w-7"
                        disabled={previewRevision.isFetching && previewRevisionId === r.id}
                        onClick={() => setPreviewRevisionId(r.id)}
                        aria-label="Preview version"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={restoreMut.isPending || r.id === data.latestRevision?.id}
                        onClick={() => void handleRestore(r.id)}
                        aria-label="Restore version"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save generated asset to KB</DialogTitle>
            <DialogDescription>
              Choose the file format and tags. The saved asset will be ingested into the knowledge base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="studio-kb-title">Save as</Label>
              <Input
                id="studio-kb-title"
                value={saveTitle}
                onChange={(event) => setSaveTitle(event.target.value)}
                placeholder="Generated sales deck"
                disabled={saveToKbMut.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-kb-format">Extension</Label>
              <select
                id="studio-kb-format"
                value={saveFormat}
                onChange={(event) => setSaveFormat(event.target.value as StudioKbSaveFormat)}
                disabled={saveToKbMut.isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="pdf">PDF</option>
                <option value="pptx">PPT</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-kb-tags">Tags</Label>
              <Input
                id="studio-kb-tags"
                value={saveTags}
                onChange={(event) => setSaveTags(event.target.value)}
                placeholder="generated, proposal, healthcare"
                disabled={saveToKbMut.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={saveToKbMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveToKb()}
              disabled={saveToKbMut.isPending || !revisionId}
            >
              {saveToKbMut.isPending ? "Saving..." : "Save to KB"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
