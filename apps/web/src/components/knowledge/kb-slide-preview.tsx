"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  KB_SLIDE_PREVIEW_CACHE_VERSION,
  kbFileUrl,
  kbPreviewUrl,
  kbSlideMetaUrl,
  kbSlideUrl,
} from "@/lib/kb/file-format";
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
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [usePdfFallback, setUsePdfFallback] = useState(false);
  const [slideCacheVersion, setSlideCacheVersion] = useState(KB_SLIDE_PREVIEW_CACHE_VERSION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUsePdfFallback(false);

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
        let cacheVersion = KB_SLIDE_PREVIEW_CACHE_VERSION;
        const metaRes = await fetch(kbSlideMetaUrl(asset.id), { cache: "no-store" });
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { slideCount?: number; cacheVersion?: string };
          if ((meta.slideCount ?? 0) > 0) count = meta.slideCount ?? count;
          if (meta.cacheVersion) cacheVersion = `${KB_SLIDE_PREVIEW_CACHE_VERSION}-${meta.cacheVersion}`;
        } else if (count <= 0) {
          if (!cancelled) {
            setError("Visual slide preview is not ready yet. Click Re-embed and refresh in a moment.");
          }
          return;
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
        const previewRes = await fetch(kbPreviewUrl(asset.id));
        if (previewRes.ok) {
          const blob = await previewRes.blob();
          if (!cancelled) setPreviewPdfUrl(URL.createObjectURL(blob));
        }

        if (!cancelled) {
          setSlideCount(count);
          setSlideCacheVersion(cacheVersion);
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

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const slideSrc = useMemo(
    () => kbSlideUrl(asset.id, currentSlide, slideCacheVersion),
    [asset.id, currentSlide, slideCacheVersion]
  );

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 type-body text-muted-foreground rounded-lg border bg-muted/20",
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
          "flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center type-body text-muted-foreground",
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
          <span className="type-body tabular-nums min-w-[5rem] text-center">
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
        {usePdfFallback && previewPdfUrl ? (
          <iframe
            title={`${asset.title} preview`}
            src={previewPdfUrl}
            className={cn("w-full rounded-md bg-white", compact ? "h-56" : "h-[65vh]")}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={slideSrc}
              src={slideSrc}
              alt={`${asset.title} — slide ${currentSlide}`}
              className={cn(
                "max-w-full rounded-md shadow-md object-contain bg-white",
                compact ? "max-h-48" : "max-h-[65vh]"
              )}
              onError={() => {
                if (previewPdfUrl) {
                  setUsePdfFallback(true);
                } else {
                  setError("Visual slide preview is unavailable for this file. Use Download original.");
                }
              }}
            />
          </>
        )}
      </div>

      {slideCount > 1 && !usePdfFallback ? (
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
                src={kbSlideUrl(asset.id, index, slideCacheVersion)}
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
