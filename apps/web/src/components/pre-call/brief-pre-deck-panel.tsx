"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Layers3, Library, Loader2, Presentation, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import {
  BriefDetailCard,
  BriefDetailRow,
  briefDetailDialogClass,
  briefMainBody,
  briefMainLead,
  briefMainMuted,
  briefMainUnderline,
} from "@/components/pre-call/brief-detail-card";
import type { PreDeck, PreDeckSlide } from "@/lib/brief-types";
import { createProjectFromPreDeck } from "@/lib/content/create-project-from-suggestion";
import { cn } from "@/lib/cn";

interface BriefPreDeckPanelProps {
  deck?: PreDeck;
  callId?: string;
  accountName?: string;
  industry?: string;
}

function SlideSourceBadge({ slide }: { slide: PreDeckSlide }) {
  const fromKb = slide.sourceType === "knowledge_base";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 type-caption",
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

export function BriefPreDeckPanel({ deck, callId, accountName, industry }: BriefPreDeckPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const slides = deck?.slides ?? [];

  async function handleContinueInStudio() {
    if (!callId || !accountName || !deck) return;
    setContinuing(true);
    try {
      const projectId = await createProjectFromPreDeck({
        callId,
        accountName,
        deckTitle: deck.title,
        slides,
        industry,
      });
      router.push(`/content/studio/${projectId}?suggestionId=predeck:${callId}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to open in Studio");
    } finally {
      setContinuing(false);
    }
  }

  if (!deck || slides.length === 0) return null;

  const slideCount = slides.length;
  const needsContent = deck.status === "needs_content";

  return (
    <>
      <BriefDetailCard
        tone="main"
        title="AI draft deck"
        icon={Presentation}
        sourceInfo={{
          source: "AI assembly + KB snippets",
          detail:
            "This is a new call-specific deck draft assembled from lead research, planned talking points, and KB proof points. Use it as a starting point, then refine it in Studio before sharing.",
        }}
        headerExtra={
          <Badge
            variant="outline"
            className={cn(
              "type-caption capitalize",
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
          <p className={cn(briefMainBody, "font-medium")}>{deck.summary}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
              <Layers3 className="h-3.5 w-3.5" />
              {slideCount} draft slide{slideCount === 1 ? "" : "s"}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            {callId && accountName && (
              <Button
                type="button"
                size="sm"
                disabled={continuing}
                onClick={() => void handleContinueInStudio()}
              >
                {continuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Continue in Studio"}
              </Button>
            )}
          </div>
          <ul className="space-y-2">
            {slides.slice(0, 3).map((slide, index) => (
              <li key={slide.id}>
                <BriefDetailRow className="flex items-start gap-2">
                  <span className="shrink-0 font-mono type-caption font-bold text-primary mt-0.5">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn(briefMainLead, index === 0 && briefMainUnderline, "truncate")}>
                        {slide.title}
                      </p>
                      <SlideSourceBadge slide={slide} />
                    </div>
                    <p className={cn(briefMainMuted, "line-clamp-2 mt-1")}>{slide.narrative}</p>
                  </div>
                </BriefDetailRow>
              </li>
            ))}
          </ul>
        </div>
      </BriefDetailCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(briefDetailDialogClass, "max-w-5xl w-[96vw] h-[90vh] flex flex-col")}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="pr-8 truncate">{deck.title}</DialogTitle>
            <DialogDescription>
              {slideCount} draft slide{slideCount === 1 ? "" : "s"} assembled for the pre-discovery call.
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
                    <p className="type-caption font-medium text-muted-foreground">
                      Slide {index + 1}
                    </p>
                    <h3 className="mt-1 type-section-title text-foreground break-words">
                      {slide.title}
                    </h3>
                  </div>
                  <SlideSourceBadge slide={slide} />
                </div>
                <p className="mt-5 text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {slide.previewText || slide.narrative}
                </p>
                {slide.assetId ? (
                  <p className="mt-auto pt-5 type-caption font-mono text-muted-foreground">
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
