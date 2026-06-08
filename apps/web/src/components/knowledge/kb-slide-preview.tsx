"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { KbFileFormatIcon } from "@/components/knowledge/kb-file-format-badge";
import {
  KB_SLIDE_PREVIEW_CACHE_VERSION,
  kbFileUrl,
  kbPreviewUrl,
  kbSlideMetaUrl,
  kbSlideUrl,
} from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";
import {
  briefDetailDialogClass,
  briefMainNestedSurfaceClass,
} from "@/components/pre-call/brief-detail-card";
import type { KBAsset } from "@/types";

interface KbSlidePreviewProps {
  asset: Pick<
    KBAsset,
    "id" | "title" | "fileName" | "mimeType" | "status" | "previewSlideCount"
  >;
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
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

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
        <Loader2 className="h-5 w-5 animate-spin text-foreground" />
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
    <>
      <KbSlidePreviewFrame
        asset={asset}
        currentSlide={currentSlide}
        downloadUrl={downloadUrl}
        mode={compact ? "compact" : "default"}
        onExpand={() => setFullScreenOpen(true)}
        previewPdfUrl={previewPdfUrl}
        setError={setError}
        setCurrentSlide={setCurrentSlide}
        setUsePdfFallback={setUsePdfFallback}
        slideCacheVersion={slideCacheVersion}
        slideCount={slideCount}
        usePdfFallback={usePdfFallback}
        className={className}
      />

      <Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
        <DialogContent
          className={cn(
            briefDetailDialogClass,
            "left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0"
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{asset.title}</DialogTitle>
            <DialogDescription>Full screen slide preview</DialogDescription>
          </DialogHeader>
          <KbSlidePreviewFrame
            asset={asset}
            currentSlide={currentSlide}
            downloadUrl={downloadUrl}
            mode="fullscreen"
            previewPdfUrl={previewPdfUrl}
            setError={setError}
            setCurrentSlide={setCurrentSlide}
            setUsePdfFallback={setUsePdfFallback}
            slideCacheVersion={slideCacheVersion}
            slideCount={slideCount}
            usePdfFallback={usePdfFallback}
            className="h-full"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type SlidePreviewMode = "compact" | "default" | "fullscreen";

interface KbSlidePreviewFrameProps {
  asset: Pick<
    KBAsset,
    "id" | "title" | "fileName" | "mimeType" | "status" | "previewSlideCount"
  >;
  currentSlide: number;
  downloadUrl: string | null;
  mode: SlidePreviewMode;
  onExpand?: () => void;
  previewPdfUrl: string | null;
  setError: (error: string) => void;
  setCurrentSlide: (updater: (slide: number) => number) => void;
  setUsePdfFallback: (useFallback: boolean) => void;
  slideCacheVersion: string;
  slideCount: number;
  usePdfFallback: boolean;
  className?: string;
}

function KbSlidePreviewFrame({
  asset,
  currentSlide,
  downloadUrl,
  mode,
  onExpand,
  previewPdfUrl,
  setError,
  setCurrentSlide,
  setUsePdfFallback,
  slideCacheVersion,
  slideCount,
  usePdfFallback,
  className,
}: KbSlidePreviewFrameProps) {
  const compact = mode === "compact";
  const fullScreen = mode === "fullscreen";
  const slideSrc = useMemo(
    () => kbSlideUrl(asset.id, currentSlide, slideCacheVersion),
    [asset.id, currentSlide, slideCacheVersion]
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border bg-muted/10",
        !fullScreen && briefMainNestedSurfaceClass,
        compact && "min-h-[28rem]",
        !compact && !fullScreen && "min-h-[70vh]",
        fullScreen && "h-full rounded-none border-0",
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2",
          fullScreen && "pr-16"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap">
          <div
            className={cn(
              "flex min-w-0 items-center gap-2",
              fullScreen ? "w-full sm:w-auto sm:max-w-[50vw]" : "w-full sm:w-auto sm:max-w-72 lg:max-w-96"
            )}
          >
            <KbFileFormatIcon
              fileName={asset.fileName}
              mimeType={asset.mimeType}
              size="sm"
              className="shrink-0"
            />
            <span className="truncate type-body font-semibold text-foreground" title={asset.title}>
              {asset.title}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
            <span className="min-w-[5.5rem] text-center type-body tabular-nums">
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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onExpand ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onExpand}
                  aria-label="Open full screen preview"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Full screen</TooltipContent>
            </Tooltip>
          ) : null}
          {downloadUrl ? (
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <a href={downloadUrl} download={asset.fileName ?? asset.title}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download original</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center bg-neutral-950/5",
          fullScreen ? "p-4 sm:p-6" : "p-4"
        )}
      >
        {usePdfFallback && previewPdfUrl ? (
          <iframe
            title={`${asset.title} preview`}
            src={previewPdfUrl}
            className={cn(
              "w-full rounded-md bg-white",
              compact && "h-56",
              !compact && !fullScreen && "h-[65vh]",
              fullScreen && "h-[calc(100dvh-11rem)]"
            )}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={slideSrc}
              src={slideSrc}
              alt={`${asset.title} — slide ${currentSlide}`}
              className={cn(
                "max-w-full rounded-md bg-white object-contain shadow-md",
                compact && "max-h-[22rem]",
                !compact && !fullScreen && "max-h-[65vh]",
                fullScreen && "max-h-[calc(100dvh-11rem)]"
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
        <div className="flex shrink-0 gap-2 overflow-x-auto border-t bg-card px-4 py-3">
          {Array.from({ length: slideCount }, (_, i) => i + 1).map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentSlide(() => index)}
              className={cn(
                "shrink-0 overflow-hidden rounded border ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentSlide === index
                  ? "border-primary ring-2 ring-primary"
                  : "border-transparent opacity-80 hover:opacity-100"
              )}
              aria-label={`Go to slide ${index}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={kbSlideUrl(asset.id, index, slideCacheVersion)}
                alt=""
                className={cn(
                  "object-cover bg-white",
                  fullScreen ? "h-16 w-28" : "h-14 w-24"
                )}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
