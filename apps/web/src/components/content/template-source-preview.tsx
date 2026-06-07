"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { cn } from "@/lib/cn";
import {
  resolveTemplatePreviewMode,
  templateFileUrl,
  templatePreviewPdfUrl,
  templateSlideUrl,
} from "@/lib/content-studio/template-preview";
import type { ContentTemplate } from "@/types/content_studio";

interface TemplateSourcePreviewProps {
  template: Pick<
    ContentTemplate,
    | "id"
    | "name"
    | "status"
    | "pageCount"
    | "sourceFileName"
    | "hasSourceFile"
    | "previewSlideCount"
    | "thumbnailUrl"
    | "artifactType"
    | "metadata"
  >;
  className?: string;
}

export function TemplateSourcePreview({ template, className }: TemplateSourcePreviewProps) {
  const preview = useMemo(() => resolveTemplatePreviewMode(template), [template]);
  const [slideCount, setSlideCount] = useState(
    preview.mode === "slides" ? preview.slideCount : 0
  );
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slideBlobUrl, setSlideBlobUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingPdfFallback, setUsingPdfFallback] = useState(false);
  const slideMetadata = template.metadata?.slides ?? [];
  const currentSlideMetadata = slideMetadata.find((slide) => slide.slide === currentSlide);

  const loadSlide = useCallback(
    async (slideIndex: number) => {
      const res = await fetch(templateSlideUrl(template.id, slideIndex), { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Slide preview unavailable (${res.status})`);
      }
      return URL.createObjectURL(await res.blob());
    },
    [template.id]
  );

  const loadPdfPreview = useCallback(async () => {
    const res = await fetch(templatePreviewPdfUrl(template.id), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`PDF preview unavailable (${res.status})`);
    }
    return URL.createObjectURL(await res.blob());
  }, [template.id]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setUsingPdfFallback(false);
      setSlideBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        if (template.status === "processing") {
          throw new Error("Template is still processing. Refresh in a moment.");
        }

        if (preview.mode === "slides") {
          try {
            const url = await loadSlide(1);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            setSlideCount(preview.slideCount);
            setCurrentSlide(1);
            setSlideBlobUrl(url);
            return;
          } catch {
            const pdfUrl = await loadPdfPreview();
            if (cancelled) {
              URL.revokeObjectURL(pdfUrl);
              return;
            }
            setUsingPdfFallback(true);
            setBlobUrl(pdfUrl);
            return;
          }
        }

        if (preview.mode === "pdf") {
          const url = await loadPdfPreview().catch(() => fetch(templateFileUrl(template.id)));
          if (url instanceof Response) {
            if (!url.ok) throw new Error(`Could not load file (${url.status})`);
            const blobUrl = URL.createObjectURL(await url.blob());
            if (!cancelled) setBlobUrl(blobUrl);
            return;
          }
          if (!cancelled) setBlobUrl(url);
          return;
        }

        if (preview.mode === "image" || preview.mode === "download") {
          const res = await fetch(templateFileUrl(template.id), { cache: "no-store" });
          if (!res.ok) throw new Error(`Could not load file (${res.status})`);
          const url = URL.createObjectURL(await res.blob());
          if (!cancelled) setBlobUrl(url);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Preview unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [template.id, template.status, preview, loadSlide, loadPdfPreview]);

  useEffect(() => {
    if (preview.mode !== "slides" || usingPdfFallback || currentSlide === 1) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const url = await loadSlide(currentSlide);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setSlideBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
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
  }, [currentSlide, preview.mode, usingPdfFallback, loadSlide]);

  useEffect(() => {
    return () => {
      if (slideBlobUrl) URL.revokeObjectURL(slideBlobUrl);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [slideBlobUrl, blobUrl]);

  if (preview.mode === "html") {
    return null;
  }

  if (loading && !slideBlobUrl && !blobUrl) {
    return (
      <div
        className={cn(
          "flex min-h-[240px] flex-1 items-center justify-center gap-2 rounded-md border bg-muted/20 text-sm text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading original file…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <p>{error}</p>
        {template.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.thumbnailUrl}
            alt=""
            className="max-h-[40vh] max-w-full rounded border object-contain"
          />
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <a href={templateFileUrl(template.id)} download={preview.mode === "slides" ? preview.fileName : undefined}>
            <Download className="mr-1 h-4 w-4" />
            Download original file
          </a>
        </Button>
      </div>
    );
  }

  if (usingPdfFallback && blobUrl) {
    return (
      <div className={cn("min-h-0 flex-1 overflow-hidden rounded-md border bg-white", className)}>
        <iframe title={`${template.name} preview`} src={blobUrl} className="h-full w-full" />
      </div>
    );
  }

  if (preview.mode === "slides" && slideCount > 0 && slideBlobUrl) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-muted/10", className)}>
        <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentSlide <= 1 || loading}
              onClick={() => setCurrentSlide((s) => Math.max(1, s - 1))}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5rem] text-center text-sm tabular-nums">
              Slide {currentSlide} / {slideCount}
            </span>
            {currentSlideMetadata?.title ? (
              <span className="hidden max-w-[18rem] truncate text-xs text-muted-foreground md:inline">
                {currentSlideMetadata.title}
                {currentSlideMetadata.layout ? ` / ${currentSlideMetadata.layout}` : ""}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentSlide >= slideCount || loading}
              onClick={() => setCurrentSlide((s) => Math.min(slideCount, s + 1))}
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <a href={templateFileUrl(template.id)} download={preview.fileName}>
              <Download className="mr-1 h-4 w-4" />
              Download original
            </a>
          </Button>
        </div>

        <div className="relative flex flex-1 min-h-0 items-center justify-center bg-neutral-950/5 p-4">
          {loading ? (
            <Loader2 className="absolute h-5 w-5 animate-spin text-muted-foreground" />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slideBlobUrl}
            alt={`${template.name} — slide ${currentSlide}`}
            className="max-h-full max-w-full rounded-md bg-white object-contain shadow-md"
          />
        </div>
      </div>
    );
  }

  if ((preview.mode === "pdf" || preview.mode === "download") && blobUrl) {
    return (
      <div className={cn("min-h-0 flex-1 overflow-hidden rounded-md border bg-white", className)}>
        <iframe title={template.name} src={blobUrl} className="h-full w-full" />
      </div>
    );
  }

  if (preview.mode === "image" && blobUrl) {
    return (
      <div className={cn("flex min-h-0 flex-1 items-center justify-center rounded-md border bg-muted/10 p-4", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={blobUrl} alt={template.name} className="max-h-full max-w-full rounded-md object-contain shadow-sm" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground",
        className
      )}
    >
      <p>Could not render a preview for this template.</p>
      <Button variant="outline" size="sm" asChild>
        <a href={templateFileUrl(template.id)}>
          <Download className="mr-1 h-4 w-4" />
          Try downloading the original file
        </a>
      </Button>
    </div>
  );
}
