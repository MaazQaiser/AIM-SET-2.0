"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { useTemplateUpload } from "@/lib/data/content-studio-hooks";

export default function TemplateUploadPage() {
  const upload = useTemplateUpload();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [artifactType, setArtifactType] = useState("deck");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    form.append("artifactType", artifactType);
    await upload.mutateAsync(form);
    window.location.href = "/content/templates";
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <Link
        href="/content/templates"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Templates
      </Link>

      <h1 className="text-2xl font-semibold">Upload template</h1>
      <p className="text-sm text-muted-foreground">
        Supported: PPT, PPTX, PDF, PNG, JPG. Each slide/page is converted to HTML/CSS via Claude vision.
      </p>

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
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="type">Artifact type</Label>
          <select
            id="type"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={artifactType}
            onChange={(e) => setArtifactType(e.target.value)}
          >
            <option value="deck">deck</option>
            <option value="one_pager">one_pager</option>
            <option value="image">image</option>
          </select>
        </div>
        <Button type="submit" disabled={!file || upload.isPending}>
          <Upload className="h-4 w-4 mr-1" />
          {upload.isPending ? "Processing…" : "Upload & convert"}
        </Button>
        {upload.isError && (
          <p className="text-sm text-destructive">{String(upload.error)}</p>
        )}
      </form>
    </div>
  );
}
