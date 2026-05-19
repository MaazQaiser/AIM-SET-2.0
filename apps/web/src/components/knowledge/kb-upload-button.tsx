"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KB_ASSET_TYPES, defaultAssetTypeForFile } from "@/lib/kb/asset-types";
import type { AssetType } from "@/types";
import type { KBIngestJob, KBUploadResponse } from "@dc-copilot/types";

const ACCEPT =
  ".png,.pdf,.docx,.jpeg,.jpg,.csv,.ppt,.pptx,image/png,image/jpeg,application/pdf";

async function pollJob(jobId: string): Promise<KBIngestJob> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`/api/kb/ingest-jobs/${jobId}`);
    if (!res.ok) throw new Error("Failed to check ingest status");
    const job = (await res.json()) as KBIngestJob;
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Ingest timed out");
}

export function KbUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("deck");
  const [tags, setTags] = useState("");
  const queryClient = useQueryClient();

  const resetForm = () => {
    setPendingFile(null);
    setTitle("");
    setAssetType("deck");
    setTags("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFileSelected = (file: File) => {
    setPendingFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    setAssetType(defaultAssetTypeForFile(file.name));
    setTags("");
    setDialogOpen(true);
  };

  const onUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("title", title.trim() || pendingFile.name.replace(/\.[^.]+$/, ""));
      form.append("asset_type", assetType);
      if (tags.trim()) {
        form.append("tags", tags.trim());
      }

      const res = await fetch("/api/kb/upload", { method: "POST", body: form });
      const data = (await res.json()) as KBUploadResponse & { detail?: string };
      if (!res.ok) {
        throw new Error(data.detail ?? "Upload failed");
      }

      setDialogOpen(false);
      resetForm();

      toast.success(`Uploaded ${data.asset.title}`);
      await queryClient.invalidateQueries({ queryKey: ["kb-assets"] });

      if (data.job?.id && data.job.status !== "done") {
        toast.info("Processing document…");
        const finalJob = await pollJob(data.job.id);
        await queryClient.invalidateQueries({ queryKey: ["kb-assets"] });
        if (finalJob.status === "failed") {
          toast.error(finalJob.errorMessage ?? "Ingest failed");
        } else {
          toast.success("Document ready in knowledge base");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
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
      <Button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? "Uploading…" : "Upload asset"}
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && !uploading) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload asset</DialogTitle>
            <DialogDescription>
              {pendingFile ? pendingFile.name : "Add metadata before ingesting into the knowledge base."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kb-upload-title">Title</Label>
              <Input
                id="kb-upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Asset title"
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-upload-type">Asset type</Label>
              <select
                id="kb-upload-type"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType)}
                disabled={uploading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={uploading || !pendingFile} onClick={() => void onUpload()}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
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
