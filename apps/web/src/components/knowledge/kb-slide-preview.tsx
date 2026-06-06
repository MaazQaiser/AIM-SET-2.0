"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { kbFileUrl, kbSlideMetaUrl, kbSlideUrl } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";
import { briefMainNestedSurfaceClass } from "@/components/pre-call/brief-detail-card";
import type { KBAsset } from "@/types";

interface KbSlidePreviewProps {
  asset: Pick<KBAsset, "id" | "title" | "fileName" | "status" | "previewSlideCount">;
  compact?: boolean;
  className?: string;
}

export function KbSlidePreview({ asset, compact = false, className }: KbSlidePreviewProps) {
  const [slideCount, setSlideCount] = useState(asset.previewSlideCount ?? 0);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

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

        let count = asset.previewSlideCount ?? 0;
        if (count <= 0) {
          const metaRes = await fetch(kbSlideMetaUrl(asset.id));
          if (!metaRes.ok) {
            if (!cancelled) {
              setError(
                "Visual slide preview is not ready. Click Re-embed on the deployed API (LibreOffice required)."
              );
            }
            return;
          }
          const meta = (await metaRes.json()) as { slideCount?: number };
          count = meta.slideCount ?? 0;
        }
        if (count <= 0) {
          if (!cancelled) setError("No slide previews available yet.");
          return;
        }

        const fileRes = await fetch(kbFileUrl(asset.id));
        if (fileRes.ok) {
          const blob = await fileRes.blob();
          if (!cancelled) setDownloadUrl(URL.createObjectURL(blob));
        }

        if (!cancelled) {
          setSlideCount(count);
          setCurrentSlide(1);
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
  }, [asset.id, asset.status, asset.previewSlideCount]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/20",
          briefMainNestedSurfaceClass,
          compact ? "min-h-[200px]" : "min-h-[420px]",
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading slides…
      </div>
    );
  }

  if (error || slideCount <= 0) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground",
          briefMainNestedSurfaceClass,
          className
        )}
      >
        <p>{error ?? "Slide preview unavailable."}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border overflow-hidden bg-muted/10",
        briefMainNestedSurfaceClass,
        compact ? "min-h-0 max-h-80" : "min-h-[70vh]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentSlide <= 1}
            onClick={() => setCurrentSlide((s) => Math.max(1, s - 1))}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums min-w-[5rem] text-center">
            Slide {currentSlide} / {slideCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentSlide >= slideCount}
            onClick={() => setCurrentSlide((s) => Math.min(slideCount, s + 1))}
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {downloadUrl ? (
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <a href={downloadUrl} download={asset.fileName ?? asset.title}>
              <Download className="h-4 w-4 mr-1" />
              Download original
            </a>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 items-center justify-center bg-neutral-950/5 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${asset.id}-${currentSlide}`}
          src={kbSlideUrl(asset.id, currentSlide)}
          alt={`${asset.title} — slide ${currentSlide}`}
          className={cn(
            "max-w-full rounded-md shadow-md object-contain bg-white",
            compact ? "max-h-48" : "max-h-[65vh]"
          )}
        />
      </div>

      {slideCount > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-t bg-card px-4 py-3">
          {Array.from({ length: slideCount }, (_, i) => i + 1).map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentSlide(index)}
              className={cn(
                "shrink-0 rounded border overflow-hidden transition ring-offset-2",
                currentSlide === index ? "ring-2 ring-primary border-primary" : "border-transparent opacity-80 hover:opacity-100"
              )}
              aria-label={`Go to slide ${index}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={kbSlideUrl(asset.id, index)}
                alt=""
                className="h-14 w-24 object-cover bg-white"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
