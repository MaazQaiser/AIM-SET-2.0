"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KbSlidePreview } from "@/components/knowledge/kb-slide-preview";
import { isPresentationFormat, kbFileUrl, resolveKbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";
import type { KBAsset } from "@/types";

interface KbAssetPreviewProps {
  asset: Pick<
    KBAsset,
    "id" | "title" | "fileName" | "mimeType" | "status" | "hasPreview" | "previewSlideCount"
  >;
  /** Pre-loaded indexed text (e.g. from relevant-content). */
  indexedText?: string;
  className?: string;
}

export function KbAssetPreview({ asset, indexedText, className }: KbAssetPreviewProps) {
  const meta = resolveKbFileFormat(asset.fileName, asset.mimeType);
  const isPresentation = isPresentationFormat(meta.format);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState(indexedText ?? "");
  const [loading, setLoading] = useState(!isPresentation);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPresentation) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    void (async () => {
      try {
        if (asset.status === "pending" || asset.status === "processing") {
          if (!cancelled) setError("Document is still processing. Refresh in a moment.");
          return;
        }
        if (asset.status === "failed") {
          if (!cancelled) setError("Ingest failed for this asset. Try re-upload or re-embed.");
          return;
        }

        const needsOriginalFile = meta.canInlinePreview || meta.format === "docx" || meta.format === "pdf";

        if (needsOriginalFile) {
          const res = await fetch(kbFileUrl(asset.id));
          if (!res.ok) throw new Error(`Could not load file (${res.status})`);
          const blob = await res.blob();
          if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
        }

        if (!meta.canInlinePreview && !indexedText) {
          const textRes = await fetch(`/api/kb/assets/${asset.id}/preview-text`);
          if (textRes.ok) {
            const data = (await textRes.json()) as { text?: string };
            if (!cancelled && data.text) setTextPreview(data.text);
          }
        } else if (indexedText) {
          setTextPreview(indexedText);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Preview unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asset.id, asset.status, asset.fileName, asset.mimeType, meta.canInlinePreview, meta.format, indexedText, isPresentation]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (isPresentation) {
    return <KbSlidePreview asset={asset} className={className} />;
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex min-h-[420px] items-center justify-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/20",
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading preview…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <p>{error}</p>
        {textPreview ? (
          <pre className="mt-4 max-h-64 w-full overflow-auto text-left text-xs whitespace-pre-wrap rounded border bg-card p-3">
            {textPreview.slice(0, 2000)}
          </pre>
        ) : null}
      </div>
    );
  }

  if (meta.format === "pdf" && blobUrl) {
    return (
      <div className={cn("min-h-[70vh] rounded-lg border overflow-hidden bg-white", className)}>
        <iframe title={asset.title} src={blobUrl} className="w-full h-[70vh]" />
      </div>
    );
  }

  if (meta.canInlinePreview && blobUrl && meta.format !== "pdf") {
    return (
      <div className={cn("flex min-h-[420px] items-center justify-center rounded-lg border bg-muted/10 p-4", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={blobUrl} alt={asset.title} className="max-h-[65vh] max-w-full object-contain rounded-md shadow-sm" />
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-[420px] flex-col gap-3 rounded-lg border bg-muted/10 p-4", className)}>
      <p className="text-sm text-muted-foreground shrink-0">Text preview from the knowledge base index.</p>
      {textPreview ? (
        <pre className="flex-1 min-h-0 overflow-auto text-xs leading-relaxed whitespace-pre-wrap rounded-lg border bg-card p-4">
          {textPreview}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">No indexed text yet.</p>
      )}
      {blobUrl ? (
        <Button variant="outline" size="sm" className="w-fit" asChild>
          <a href={blobUrl} download={asset.fileName ?? asset.title}>
            <Download className="h-4 w-4 mr-1" />
            Download file
          </a>
        </Button>
      ) : null}
    </div>
  );
}
