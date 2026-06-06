"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { useTemplateUpload } from "@/lib/data/content-studio-hooks";
import { TEMPLATE_ARTIFACT_TYPES } from "@/lib/content-studio/template-editor";

export default function TemplateUploadPage() {
  const upload = useTemplateUpload();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [artifactType, setArtifactType] = useState("deck");
  const [tagsText, setTagsText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    form.append("artifactType", artifactType);
    if (tagsText.trim()) form.append("tags", tagsText.trim());
    await upload.mutateAsync(form);
    window.location.href = "/content?tab=templates";
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
        Upload industry vertical decks, case studies, or one-pagers. PPT, PPTX, PDF, PNG, and JPG
        files are converted to reusable HTML/CSS for Content Studio.
      </p>
      <Button variant="outline" asChild>
        <Link href="/content/templates/new">Create with HTML/CSS instead</Link>
      </Button>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            type="file"
            accept=".ppt,.pptx,.pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Transportation vertical deck"
          />
        </div>
        <div>
          <Label htmlFor="type">Template type</Label>
          <select
            id="type"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={artifactType}
            onChange={(e) => setArtifactType(e.target.value)}
          >
            {TEMPLATE_ARTIFACT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tags">Tags (optional)</Label>
          <Input
            id="tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="transportation, logistics, vertical"
          />
          <p className="mt-1 text-xs text-muted-foreground">Comma-separated — used for matching in Content Studio.</p>
        </div>
        <Button type="submit" disabled={!file || upload.isPending}>
          <Upload className="h-4 w-4 mr-1" />
          {upload.isPending ? "Processing…" : "Upload & convert"}
        </Button>
        {upload.isError && <p className="text-sm text-destructive">{String(upload.error)}</p>}
      </form>
    </div>
  );
}
