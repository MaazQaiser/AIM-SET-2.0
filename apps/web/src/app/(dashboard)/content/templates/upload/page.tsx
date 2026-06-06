"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import type { ContentTemplate } from "@/types/content_studio";

type UploadPhase = "idle" | "uploading" | "processing" | "done";

interface TemplateUploadResponse {
  template: ContentTemplate;
  storagePath: string;
}

function uploadTemplateWithProgress(
  form: FormData,
  onUploadPct: (pct: number) => void
): Promise<TemplateUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/content/templates/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadPct(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}") as TemplateUploadResponse & {
          detail?: string;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.detail ?? data.error ?? (xhr.responseText || `Upload failed (${xhr.status})`)));
        }
      } catch {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during template upload."));
    xhr.send(form);
  });
}

async function pollTemplate(
  templateId: string,
  onTemplate: (template: ContentTemplate) => void
): Promise<ContentTemplate> {
  for (let i = 0; i < 160; i += 1) {
    const res = await fetch(`/api/content/templates/${templateId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to check template processing status");
    const template = (await res.json()) as ContentTemplate;
    onTemplate(template);
    if (template.status === "ready" || template.status === "failed") return template;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Template processing timed out");
}

function combinedProgress(phase: UploadPhase, uploadPct: number, processingPct: number): number {
  if (phase === "uploading") return Math.max(8, Math.round(uploadPct * 0.35));
  if (phase === "processing") return 35 + Math.round(processingPct * 0.65);
  if (phase === "done") return 100;
  return 0;
}

export default function TemplateUploadPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [processingPct, setProcessingPct] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [error, setError] = useState("");

  const busy = phase === "uploading" || phase === "processing";
  const progress = combinedProgress(phase, uploadPct, processingPct);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setPhase("uploading");
    setUploadPct(0);
    setProcessingPct(0);
    setStageLabel("Uploading PowerPoint...");
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    form.append("artifactType", "deck");
    if (tagsText.trim()) form.append("tags", tagsText.trim());
    try {
      const result = await uploadTemplateWithProgress(form, setUploadPct);
      setPhase("processing");
      setProcessingPct(result.template.metadata?.processing?.progress ?? 8);
      setStageLabel(result.template.metadata?.processing?.message ?? "Queued for extraction...");

      const finalTemplate = await pollTemplate(result.template.id, (template) => {
        const processing = template.metadata?.processing;
        setProcessingPct(processing?.progress ?? (template.status === "ready" ? 100 : 30));
        setStageLabel(processing?.message ?? (template.status === "ready" ? "Template ready" : "Processing..."));
      });

      await queryClient.invalidateQueries({ queryKey: ["content-templates"] });
      if (finalTemplate.status === "failed") {
        throw new Error(finalTemplate.ingestError ?? "Template extraction failed");
      }
      setPhase("done");
      setProcessingPct(100);
      setStageLabel("Template ready");
      window.setTimeout(() => {
        window.location.href = "/content?tab=templates";
      }, 500);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <Link
        href="/content?tab=templates"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Templates
      </Link>

      <h1 className="text-2xl font-semibold">Upload template</h1>
      <p className="text-sm text-muted-foreground">
        Upload a PPT or PPTX file. Content Studio extracts the original slide preview, slide
        structure, colors, text, and generated HTML/CSS before the template can be edited or used.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            type="file"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Transportation vertical deck"
          />
        </div>
        <div>
          <Label htmlFor="tags">Tags (optional)</Label>
          <Input
            id="tags"
            value={tagsText}
            disabled={busy}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="transportation, logistics, vertical"
          />
          <p className="mt-1 text-xs text-muted-foreground">Comma-separated — used for matching in Content Studio.</p>
        </div>
        {phase !== "idle" ? (
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{stageLabel || "Preparing..."}</span>
              <span className="tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <span className={progress >= 10 ? "text-foreground" : ""}>Upload</span>
              <span className={progress >= 45 ? "text-foreground" : ""}>Extract</span>
              <span className={progress >= 75 ? "text-foreground" : ""}>Generate HTML/CSS</span>
            </div>
          </div>
        ) : null}
        <Button type="submit" disabled={!file || busy}>
          {phase === "done" ? (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          ) : busy ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {busy ? "Processing..." : phase === "done" ? "Ready" : "Upload & extract"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
