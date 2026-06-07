"use client";

import { useRef, useState, type ReactNode } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import { KB_ASSET_TYPES, defaultAssetTypeForFile } from "@/lib/kb/asset-types";
import type { AssetType } from "@/types";
import type { KBIngestJob, KBUploadResponse } from "@dc-copilot/types";

const ACCEPT =
  ".png,.pdf,.docx,.jpeg,.jpg,.csv,.ppt,.pptx,image/png,image/jpeg,application/pdf";

type UploadPhase = "idle" | "uploading" | "processing" | "done";

async function pollJob(
  jobId: string,
  onProgress: (pct: number, stage: string) => void
): Promise<KBIngestJob> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`/api/kb/ingest-jobs/${jobId}`);
    if (!res.ok) throw new Error("Failed to check ingest status");
    const job = (await res.json()) as KBIngestJob;
    onProgress(job.progressPct ?? 0, job.stage ?? job.status);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Ingest timed out");
}

function uploadWithProgress(
  form: FormData,
  onUploadPct: (pct: number) => void
): Promise<KBUploadResponse & { detail?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/kb/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadPct(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}") as KBUploadResponse & {
          detail?: string;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const detail = data.detail ?? data.error ?? xhr.responseText?.slice(0, 300);
          reject(new Error(detail || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Network error during upload. Check that the API is running and INTERNAL_API_SECRET matches services/api/.env."
        )
      );
    xhr.send(form);
  });
}

function combinedProgress(phase: UploadPhase, uploadPct: number, ingestPct: number): number {
  if (phase === "uploading") return Math.round(uploadPct * 0.45);
  if (phase === "processing") return 45 + Math.round(ingestPct * 0.55);
  if (phase === "done") return 100;
  return 0;
}

interface KbUploadButtonProps {
  onAssetReady?: (asset: { id: string; title: string }) => void;
  trigger?: ReactNode;
  defaultTitle?: string;
}

export function KbUploadButton({ onAssetReady, trigger, defaultTitle }: KbUploadButtonProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [ingestPct, setIngestPct] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("deck");
  const [tags, setTags] = useState("");
  const queryClient = useQueryClient();

  const busy = phase === "uploading" || phase === "processing";
  const overallPct = combinedProgress(phase, uploadPct, ingestPct);

  const resetForm = () => {
    setPendingFile(null);
    setTitle("");
    setAssetType("deck");
    setTags("");
    setUploadPct(0);
    setIngestPct(0);
    setStageLabel("");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFileSelected = (file: File) => {
    setPendingFile(file);
    setTitle(defaultTitle?.trim() || file.name.replace(/\.[^.]+$/, ""));
    setAssetType(defaultAssetTypeForFile(file.name));
    setTags("");
    setDialogOpen(true);
  };

  const onUpload = async () => {
    if (!pendingFile) return;
    setPhase("uploading");
    setUploadPct(0);
    setIngestPct(0);
    setStageLabel("Uploading file…");

    try {
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("title", title.trim() || pendingFile.name.replace(/\.[^.]+$/, ""));
      form.append("asset_type", assetType);
      if (tags.trim()) form.append("tags", tags.trim());

      const data = await uploadWithProgress(form, setUploadPct);

      if (data.job?.status === "failed") {
        throw new Error(data.job.errorMessage ?? data.asset?.ingestError ?? "Ingest failed");
      }

      await queryClient.invalidateQueries({ queryKey: ["kb-assets"] });

      if (data.job?.id && data.job.status !== "done") {
        setPhase("processing");
        setStageLabel("Processing & indexing…");
        const finalJob = await pollJob(data.job.id, (pct, stage) => {
          setIngestPct(pct);
          setStageLabel(
            stage === "embedding"
              ? "Embedding for search…"
              : stage === "chunking"
                ? "Chunking document…"
                : stage === "parsing"
                  ? "Parsing document…"
                  : "Processing…"
          );
        });
        await queryClient.invalidateQueries({ queryKey: ["kb-assets"] });
        if (finalJob.status === "failed") {
          throw new Error(finalJob.errorMessage ?? "Ingest failed");
        }
      }

      setPhase("done");
      setStageLabel("Ready");
      toast.success(`${data.asset.title} is ready in the knowledge base`);
      onAssetReady?.({ id: data.asset.id, title: data.asset.title });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setPhase("idle");
      setStageLabel("");
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
        }}
      />
      {trigger ? (
        <span
          role="button"
          tabIndex={busy ? -1 : 0}
          className={busy ? "pointer-events-none opacity-60" : "inline-flex"}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!busy && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {trigger}
        </span>
      ) : (
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? `Uploading ${overallPct}%` : "Upload asset"}
        </Button>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (busy) return;
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload asset</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {pendingFile ? (
                <>
                  <span className="truncate max-w-[240px]">{pendingFile.name}</span>
                  <KbFileFormatBadge fileName={pendingFile.name} />
                </>
              ) : (
                "Add metadata before ingesting into the knowledge base."
              )}
            </DialogDescription>
          </DialogHeader>

          {busy && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex justify-between type-caption text-muted-foreground">
                <span>{stageLabel}</span>
                <span className="tabular-nums font-medium text-foreground">{overallPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kb-upload-title">Title</Label>
              <Input
                id="kb-upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-upload-type">Asset type</Label>
              <select
                id="kb-upload-type"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType)}
                disabled={busy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 type-body"
              >
                {KB_ASSET_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-upload-tags">Tags</Label>
              <Input
                id="kb-upload-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. healthcare, Q4-2025"
                disabled={busy}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !pendingFile} onClick={() => void onUpload()}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {overallPct}%
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
