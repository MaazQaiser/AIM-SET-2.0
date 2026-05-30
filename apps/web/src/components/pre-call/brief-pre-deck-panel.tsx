"use client";

import { useState } from "react";
import { Eye, Layers3, Library, Presentation, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { BriefDetailCard, BriefDetailRow } from "@/components/pre-call/brief-detail-card";
import type { PreDeck, PreDeckSlide } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface BriefPreDeckPanelProps {
  deck?: PreDeck;
}

function SlideSourceBadge({ slide }: { slide: PreDeckSlide }) {
  const fromKb = slide.sourceType === "knowledge_base";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px]",
        fromKb
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-primary/25 bg-primary/10 text-primary"
      )}
    >
      {fromKb ? <Library className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
      {fromKb ? "KB" : "Workflow"}
    </Badge>
  );
}

export function BriefPreDeckPanel({ deck }: BriefPreDeckPanelProps) {
  const [open, setOpen] = useState(false);
  const slides = deck?.slides ?? [];

  if (!deck || slides.length === 0) return null;

  const slideCount = slides.length;
  const needsContent = deck.status === "needs_content";

  return (
    <>
      <BriefDetailCard
        title="Pre-call deck"
        icon={Presentation}
        sourceInfo={{
          source: "AI assembly + KB snippets",
          detail:
            "This preview deck is assembled from the lead research, planned talking points, and any KB proof points found for the account. It is a prep preview, not a final customer deck.",
        }}
        headerExtra={
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] capitalize",
              needsContent
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            )}
          >
            {needsContent ? "Needs content" : "Preview ready"}
          </Badge>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground/85 leading-relaxed">{deck.summary}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers3 className="h-3.5 w-3.5" />
              {slideCount} preview slide{slideCount === 1 ? "" : "s"}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </div>
          <ul className="space-y-2">
            {slides.slice(0, 3).map((slide, index) => (
              <li key={slide.id}>
                <BriefDetailRow className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-[10px] font-bold text-primary mt-0.5">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium truncate">{slide.title}</p>
                      <SlideSourceBadge slide={slide} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {slide.narrative}
                    </p>
                  </div>
                </BriefDetailRow>
              </li>
            ))}
          </ul>
        </div>
      </BriefDetailCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[96vw] h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="pr-8 truncate">{deck.title}</DialogTitle>
            <DialogDescription>
              {slideCount} slide preview assembled for the pre-discovery call.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-1">
            {slides.map((slide, index) => (
              <section
                key={slide.id}
                className="glass-insight-card min-h-[360px] p-5 flex flex-col"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Slide {index + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground break-words">
                      {slide.title}
                    </h3>
                  </div>
                  <SlideSourceBadge slide={slide} />
                </div>
                <p className="mt-5 text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {slide.previewText || slide.narrative}
                </p>
                {slide.assetId ? (
                  <p className="mt-auto pt-5 text-[10px] font-mono text-muted-foreground">
                    KB asset: {slide.assetId}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
