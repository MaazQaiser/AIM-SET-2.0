"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@dc-copilot/ui/components/popover";
import { Button } from "@dc-copilot/ui/components/button";
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
import { StudioChat, type StudioChatHandle } from "@/components/content/studio-chat";
import { StudioPreview } from "@/components/content/studio-preview";
import { SuggestionContextBar } from "@/components/content/suggestion-context-bar";
import {
  useContentTemplates,
  useRestoreStudioRevision,
  useSaveRevisionToKb,
  useStudioBootstrap,
  useStudioExport,
  useStudioProject,
  useStudioRevision,
} from "@/lib/data/content-studio-hooks";
import { useKbAssets } from "@/lib/data/hooks";
import type { StudioKbSaveFormat, StudioTurnResult } from "@/types/content_studio";

export default function StudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  void searchParams.get("suggestionId");
  const { data, refetch, isLoading } = useStudioProject(projectId, { includeLatest: false });
  const project = data?.project;
  const templates = useContentTemplates(project?.artifactType);
  const kbAssets = useKbAssets();
  const exportMut = useStudioExport(projectId);
  const bootstrapMut = useStudioBootstrap(projectId);
  const restoreMut = useRestoreStudioRevision(projectId);
  const saveToKbMut = useSaveRevisionToKb(projectId);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | undefined>();
  const [previewRevisionId, setPreviewRevisionId] = useState<string | undefined>();
  const [actionMessage, setActionMessage] = useState<string>("");
  const [hideSuggestion, setHideSuggestion] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTags, setSaveTags] = useState("generated, content-studio");
  const [saveFormat, setSaveFormat] = useState<StudioKbSaveFormat>("pdf");
  const [isGenerating, setIsGenerating] = useState(false);
  const bootstrapAttemptedRef = useRef(false);
  const chatRef = useRef<StudioChatHandle | null>(null);

  useEffect(() => {
    const pickTemplate = searchParams.get("pickTemplate");
    if (pickTemplate) {
      setSelectedTemplateId(pickTemplate);
    }
  }, [searchParams]);

  const brief = (project?.brief ?? {}) as Record<string, unknown>;
  const suggestionPlan = brief.suggestion_plan as import("@/types/content_studio").SuggestionPlan | undefined;
  const hasSuggestionContext = Boolean(
    brief.generation_reason ||
    brief.needed_for ||
    brief.asset_name ||
    brief.content_requirements ||
    brief.what_to_create ||
    brief.account_name ||
    brief.source_asset ||
    suggestionPlan
  );
  const artifactLabel =
    project?.artifactType === "one_pager"
      ? "one-pager"
      : project?.artifactType === "image"
        ? "image"
        : "deck";
  const sortedRevisions = useMemo(
    () =>
      [...(data?.revisions ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [data?.revisions]
  );
  const activeRevisionIndex = useMemo(() => {
    if (sortedRevisions.length === 0) return -1;
    if (previewRevisionId) {
      const index = sortedRevisions.findIndex((revision) => revision.id === previewRevisionId);
      return index >= 0 ? index : sortedRevisions.length - 1;
    }
    return sortedRevisions.length - 1;
  }, [previewRevisionId, sortedRevisions]);
  const latestRevisionId =
    sortedRevisions.length > 0 ? sortedRevisions[sortedRevisions.length - 1]?.id : undefined;
  const latestRevision = useStudioRevision(projectId, latestRevisionId);
  const previewRevision = useStudioRevision(projectId, previewRevisionId);
  const activeRevision = previewRevisionId
    ? previewRevision.data
    : latestRevision.data ?? data?.latestRevision;
  const latestHtml = previewHtml ?? activeRevision?.html;
  const revisionId = previewRevisionId ?? activeRevision?.id ?? latestRevisionId;
  const viewingOlderVersion =
    activeRevisionIndex >= 0 && activeRevisionIndex < sortedRevisions.length - 1;

  function selectRevisionByIndex(index: number) {
    const revision = sortedRevisions[index];
    if (!revision) return;

    const isLatest = index === sortedRevisions.length - 1;
    if (isLatest) {
      setPreviewRevisionId(undefined);
      setPreviewHtml(undefined);
      setActionMessage("");
      return;
    }

    setPreviewHtml(undefined);
    setPreviewRevisionId(revision.id);
  }

  const onTurn = useCallback((result: StudioTurnResult) => {
    setPreviewRevisionId(undefined);
    setActionMessage("");
    if (result.html) {
      setPreviewHtml(result.html);
      setActionMessage("Draft ready — review the preview and ask for any changes.");
    }
    if (result.template_id) {
      setSelectedTemplateId(result.template_id);
    } else if (result.recommended_templates?.length) {
      const first = result.recommended_templates[0]?.template_id;
      if (first) setSelectedTemplateId(first);
    }
  }, []);

  const onRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onStreamDone = useCallback(() => {
    setIsGenerating(false);
  }, []);

  // Bootstrap from suggestion context (first load only).
  // Also runs when the only existing messages are seeded user messages (deep-link path),
  // i.e. no assistant reply has been sent yet.
  useEffect(() => {
    if (!project || bootstrapAttemptedRef.current) return;
    if (!hasSuggestionContext) return;

    const messages = data?.messages ?? [];
    const hasAssistantReply = messages.some((m) => m.role === "assistant");
    if (hasAssistantReply) return; // already bootstrapped

    bootstrapAttemptedRef.current = true;
    void bootstrapMut.mutateAsync().then((envelope) => {
      if (envelope.operation === "studio_bootstrap_skipped") return;
      onTurn(envelope.result);
    });
  }, [bootstrapMut, data?.messages, hasSuggestionContext, onTurn, project]);

  // Load a specific revision for preview
  useEffect(() => {
    const html = previewRevision.data?.html;
    if (!html) return;
    setPreviewHtml(html);
    setActionMessage("Previewing an older version. Restore it to make it current.");
  }, [previewRevision.data?.html]);

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
    const tags = saveTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    setActionMessage(`Saving ${saveFormat.toUpperCase()} to KB...`);
    const result = await saveToKbMut.mutateAsync({ revisionId, title, tags, format: saveFormat });
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

  // Generate button — delegates to the chat's streaming generate path.
  // Template selection is mandatory; if missing the chat will highlight the picker.
  function handleGenerateClick() {
    if (!chatRef.current?.hasTemplate()) {
      chatRef.current?.sendGenerate();
      return;
    }
    setIsGenerating(true);
    setActionMessage("Generating…");
    chatRef.current.sendGenerate();
  }

  if (isLoading || !project) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-6">
        <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="animate-pulse rounded-lg bg-muted lg:col-span-4" />
          <div className="animate-pulse rounded-lg bg-muted lg:col-span-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-4 p-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-6 shrink-0 space-y-4 border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur-md">
        <Link
          href="/content?tab=studio"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Content Studio
        </Link>

        {!hideSuggestion && Boolean(brief.generation_reason || brief.asset_name || suggestionPlan) ? (
          <SuggestionContextBar brief={brief} onDismiss={() => setHideSuggestion(true)} />
        ) : null}

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{project.title}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <p className="capitalize">
                {project.artifactType} · ${project.costUsd.toFixed(2)} spent · cap $1.50
              </p>
              {sortedRevisions.length > 0 ? (
                <div className="flex items-center gap-1">
                  <span>Version</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={activeRevisionIndex <= 0}
                    onClick={() => selectRevisionByIndex(activeRevisionIndex - 1)}
                    aria-label="Previous version"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[2.75rem] text-center tabular-nums text-foreground">
                    {activeRevisionIndex + 1}/{sortedRevisions.length}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={activeRevisionIndex >= sortedRevisions.length - 1}
                    onClick={() => selectRevisionByIndex(activeRevisionIndex + 1)}
                    aria-label="Next version"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  {viewingOlderVersion ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={restoreMut.isPending}
                      onClick={() => void handleRestore(sortedRevisions[activeRevisionIndex].id)}
                      aria-label="Restore this version"
                      title="Restore this version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              onClick={handleGenerateClick}
              disabled={isGenerating}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {isGenerating ? "Generating…" : `Generate ${artifactLabel}`}
            </Button>
            <Popover open={downloadOpen} onOpenChange={setDownloadOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!revisionId || exportMut.isPending}
                >
                  <Download className="h-3 w-3 mr-1" />
                  {exportMut.isPending ? "Downloading…" : "Download"}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-36 p-1">
                {(["pdf", "png", "pptx"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                    disabled={exportMut.isPending}
                    onClick={() => {
                      setDownloadOpen(false);
                      void handleExport(fmt);
                    }}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
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
      </div>

      {actionMessage && (
        <div className="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Chat panel */}
        <div className="lg:col-span-4 min-h-0 flex flex-col">
          <StudioChat
            projectId={projectId}
            messages={data?.messages ?? []}
            onTurn={onTurn}
            onRefetch={onRefetch}
            onStreamDone={onStreamDone}
            selectedTemplateId={selectedTemplateId ?? project.templateId ?? undefined}
            onTemplateSelect={setSelectedTemplateId}
            templates={templates.data ?? []}
            isLoadingTemplates={templates.isLoading}
            recommendedTemplateIds={project.recommendedTemplateIds}
            hasSuggestionContext={hasSuggestionContext}
            isBootstrapping={bootstrapMut.isPending}
            chatRef={chatRef}
            kbAssets={kbAssets.data ?? []}
            artifactType={project.artifactType}
            projectTitle={project.title}
          />
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-8 min-h-0">
          <StudioPreview html={latestHtml} />
        </div>
      </div>

      {/* Save to KB dialog */}
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
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Generated sales deck"
                disabled={saveToKbMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studio-kb-format">Extension</Label>
              <select
                id="studio-kb-format"
                value={saveFormat}
                onChange={(e) => setSaveFormat(e.target.value as StudioKbSaveFormat)}
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
                onChange={(e) => setSaveTags(e.target.value)}
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
