"use client";

import { useMemo, useState, useDeferredValue } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Copy,
  Eye,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Lock,
  Palette,
  Plus,
  Save,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button, buttonVariants } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { cn } from "@dc-copilot/ui/lib/cn";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import {
  buildScratchTemplateDocument,
  createDefaultFixedEndSlides,
  createDefaultFixedStartSlides,
  createScratchSlide,
  SCRATCH_FONT_OPTIONS,
  SCRATCH_LAYOUT_OPTIONS,
  type ScratchLogoAsset,
  type ScratchSlideDraft,
  type ScratchSlideLayout,
  type ScratchTemplateFont,
} from "@/lib/content-studio/scratch-template";
import { compileTemplateDocument } from "@/lib/content-studio/template-editor";
import { useCreateTemplate, useParentTemplate } from "@/lib/data/content-studio-hooks";
import type { ContentTemplate } from "@/types/content_studio";

function SlideListButton({
  slide,
  globalIndex,
  isActive,
  isFixed = false,
  onClick,
}: {
  slide: ScratchSlideDraft;
  globalIndex: number;
  isActive: boolean;
  isFixed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card hover:bg-muted/40"
      )}
      onClick={onClick}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          {isFixed ? <Lock className="h-2.5 w-2.5 text-amber-500" /> : null}
          Slide {globalIndex + 1}
        </span>
        <span className="block truncate font-medium">
          {slide.layout === "blank" ? "Blank slide" : slide.title || "Untitled"}
        </span>
      </span>
      <Badge variant="outline" className="shrink-0 capitalize">
        {slide.layout.replace(/_/g, " ")}
      </Badge>
    </button>
  );
}

const QUICK_ADD_LAYOUTS: Array<{ layout: ScratchSlideLayout; label: string }> = [
  { layout: "cover", label: "Cover" },
  { layout: "section", label: "Section" },
  { layout: "blank", label: "Blank" },
];
const PREVIEW_SCALE = 0.34;
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

export function TemplateScratchBuilder() {
  const { data: parentTemplate, isLoading: parentLoading } = useParentTemplate();

  if (parentLoading) {
    return (
      <PageShell size="wide" className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </PageShell>
    );
  }

  return <TemplateScratchBuilderForm parentTemplate={parentTemplate ?? null} />;
}

function TemplateScratchBuilderForm({ parentTemplate }: { parentTemplate: ContentTemplate | null }) {
  const create = useCreateTemplate();
  const [name, setName] = useState("Scratch deck template");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [textColor, setTextColor] = useState("#0f172a");
  const [fontFamily, setFontFamily] = useState<ScratchTemplateFont>("urbanist");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");

  const parentDraft = (parentTemplate?.metadata as { fixedSlidesDraft?: { startSlides?: ScratchSlideDraft[]; endSlides?: ScratchSlideDraft[] } } | null)?.fixedSlidesDraft;

  // Fixed slides — seeded from the parent template if one is configured.
  const [fixedStartSlides, setFixedStartSlides] = useState<ScratchSlideDraft[]>(
    () => parentDraft?.startSlides?.length ? parentDraft.startSlides : createDefaultFixedStartSlides()
  );
  const [fixedEndSlides, setFixedEndSlides] = useState<ScratchSlideDraft[]>(
    () => parentDraft?.endSlides?.length ? parentDraft.endSlides : createDefaultFixedEndSlides()
  );

  // User-editable slides between the two fixed groups.
  const [slides, setSlides] = useState<ScratchSlideDraft[]>([createScratchSlide(1)]);

  const allSlides = useMemo(
    () => [...fixedStartSlides, ...slides, ...fixedEndSlides],
    [fixedStartSlides, slides, fixedEndSlides]
  );

  const [activeSlideId, setActiveSlideId] = useState(() => fixedStartSlides[0]?.id ?? "");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const activeIndex = Math.max(
    0,
    allSlides.findIndex((slide) => slide.id === activeSlideId)
  );
  const activeSlide = allSlides[activeIndex] ?? allSlides[0];
  const activeSlideTextColor = activeSlide.textColor ?? textColor;
  const isBlankSlide = activeSlide.layout === "blank";
  const isActiveFixed = activeSlide?.isFixed ?? false;

  function getActiveGroup(): "fixedStart" | "middle" | "fixedEnd" {
    if (fixedStartSlides.some((s) => s.id === activeSlide.id)) return "fixedStart";
    if (fixedEndSlides.some((s) => s.id === activeSlide.id)) return "fixedEnd";
    return "middle";
  }
  const logos = useMemo<ScratchLogoAsset[]>(
    () =>
      logoDataUrl
        ? [
            {
              id: "logo",
              label: "Logo",
              dataUrl: logoDataUrl,
              fileName: logoFileName,
              isPrimary: true,
            },
          ]
        : [],
    [logoDataUrl, logoFileName]
  );

  // Defer the preview inputs so the editor stays responsive during fast edits.
  // The iframe recompile is expensive; it runs during React's idle time.
  const previewInputs = useMemo(
    () => ({ name, accentColor, textColor, fontFamily, logos, fixedStartSlides, slides, fixedEndSlides }),
    [accentColor, fixedEndSlides, fixedStartSlides, fontFamily, logos, name, slides, textColor]
  );
  const deferredPreviewInputs = useDeferredValue(previewInputs);

  const compiled = useMemo(
    () =>
      buildScratchTemplateDocument({
        name: deferredPreviewInputs.name,
        accentColor: deferredPreviewInputs.accentColor,
        textColor: deferredPreviewInputs.textColor,
        fontFamily: deferredPreviewInputs.fontFamily,
        tags: [],
        logos: deferredPreviewInputs.logos,
        fixedStartSlides: deferredPreviewInputs.fixedStartSlides,
        slides: deferredPreviewInputs.slides,
        fixedEndSlides: deferredPreviewInputs.fixedEndSlides,
      }),
    [deferredPreviewInputs]
  );
  const previewHtml = useMemo(() => compileTemplateDocument(compiled.html, compiled.css), [compiled]);
  const previewFrameHeight = Math.max(1, allSlides.length) * 740;

  function updateActiveSlide(patch: Partial<ScratchSlideDraft>) {
    const updater = (current: ScratchSlideDraft[]) =>
      current.map((s) => (s.id === activeSlide.id ? { ...s, ...patch } : s));
    const group = getActiveGroup();
    if (group === "fixedStart") setFixedStartSlides(updater);
    else if (group === "fixedEnd") setFixedEndSlides(updater);
    else setSlides(updater);
  }

  function addSlide(layout: ScratchSlideLayout = "section") {
    const next = { ...createScratchSlide(slides.length + 1, layout), textColor };
    setSlides((current) => [...current, next]);
    setActiveSlideId(next.id);
  }

  function duplicateSlide() {
    const next = {
      ...activeSlide,
      id: createScratchSlide(slides.length + 1, activeSlide.layout).id,
      title: `${activeSlide.title} copy`,
    };
    setSlides((current) => {
      const nextSlides = [...current];
      nextSlides.splice(activeIndex + 1, 0, next);
      return nextSlides;
    });
    setActiveSlideId(next.id);
  }

  function removeSlide() {
    if (isActiveFixed || slides.length <= 1) return;
    setSlides((current) => {
      const nextSlides = current.filter((slide) => slide.id !== activeSlide.id);
      // activeIndex here is relative to allSlides; find the new neighbour in middle slides.
      const middleActiveIdx = current.findIndex((s) => s.id === activeSlide.id);
      setActiveSlideId(
        nextSlides[Math.max(0, middleActiveIdx - 1)]?.id ?? nextSlides[0]?.id ?? allSlides[0]?.id ?? ""
      );
      return nextSlides;
    });
  }

  async function handleLogoUpload(file?: File | null) {
    if (!file) return;
    const dataUrl = await readCheckedImage(file);
    if (!dataUrl) return;
    setLogoDataUrl(dataUrl);
    setLogoFileName(file.name);
  }

  function removeLogo() {
    setLogoDataUrl("");
    setLogoFileName("");
  }

  async function handleBackgroundUpload(file?: File | null) {
    if (!file) return;
    const dataUrl = await readCheckedImage(file);
    if (!dataUrl) return;
    updateActiveSlide({ backgroundImageDataUrl: dataUrl, backgroundImageName: file.name });
  }

  async function readCheckedImage(file: File): Promise<string | null> {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Use an image file for backgrounds or logos.");
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Use images under 3.5 MB for this scratch template flow.");
      return null;
    }
    try {
      return await readImageDataUrl(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image file.");
      return null;
    }
  }

  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (slides.length < 1) {
      setError("Add at least one slide.");
      return;
    }
    try {
      const saved = await create.mutateAsync({
        name: name.trim(),
        artifactType: "deck",
        tags: [],
        html: compiled.html,
        css: compiled.css,
      });
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      window.location.href = `/content/templates/${saved.id}/edit`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template.");
    }
  }

  return (
    <PageShell size="wide" className="space-y-4">
      <PageHeader className="space-y-3">
        <Link
          href="/content?tab=templates"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Templates
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">Create template from scratch</h1>
              <Badge variant="secondary">Slide skeleton</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Build the base slide structure, then choose fonts, add background images, and place logos before saving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastSavedAt ? (
              <span className="text-xs text-muted-foreground">Saved {lastSavedAt}</span>
            ) : null}
            <Button type="button" onClick={() => void handleSave()} disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save template
            </Button>
          </div>
        </div>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LayoutTemplate className="h-4 w-4" />
              Slides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scratch-name">Template name</Label>
              <Input id="scratch-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scratch-accent" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Accent
              </Label>
              <div className="flex gap-2">
                <Input
                  id="scratch-accent"
                  type="color"
                  value={accentColor}
                  onChange={(event) => setAccentColor(event.target.value)}
                  className="h-10 w-14 p-1"
                />
                <Input value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scratch-font" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Font
              </Label>
              <select
                id="scratch-font"
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value as ScratchTemplateFont)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {SCRATCH_FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scratch-text-color" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Default font color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="scratch-text-color"
                  type="color"
                  value={textColor}
                  onChange={(event) => setTextColor(event.target.value)}
                  className="h-10 w-14 p-1"
                />
                <Input value={textColor} onChange={(event) => setTextColor(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scratch-logo">Logo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="scratch-logo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    void handleLogoUpload(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <Label
                  htmlFor="scratch-logo"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-32 cursor-pointer justify-start"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload logo
                </Label>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {logoFileName || "No file"}
                </span>
                {logoDataUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={removeLogo}
                    aria-label="Remove logo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Add slide</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_ADD_LAYOUTS.map(({ layout, label }) => (
                  <Button
                    key={layout}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addSlide(layout)}
                  >
                    <Plus className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* ── Slide list — 3 groups ── */}
            <div className="space-y-3">
              <Label>Slide list</Label>

              {/* Fixed — Start */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                  <Lock className="h-3 w-3" />
                  Fixed — Start
                </div>
                {fixedStartSlides.map((slide, idx) => (
                  <SlideListButton
                    key={slide.id}
                    slide={slide}
                    globalIndex={idx}
                    isActive={slide.id === activeSlide.id}
                    isFixed
                    onClick={() => setActiveSlideId(slide.id)}
                  />
                ))}
              </div>

              {/* Your slides */}
              <div className="space-y-1">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your slides
                </div>
                {slides.map((slide, idx) => (
                  <SlideListButton
                    key={slide.id}
                    slide={slide}
                    globalIndex={fixedStartSlides.length + idx}
                    isActive={slide.id === activeSlide.id}
                    onClick={() => setActiveSlideId(slide.id)}
                  />
                ))}
              </div>

              {/* Fixed — End */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                  <Lock className="h-3 w-3" />
                  Fixed — End
                </div>
                {fixedEndSlides.map((slide, idx) => (
                  <SlideListButton
                    key={slide.id}
                    slide={slide}
                    globalIndex={fixedStartSlides.length + slides.length + idx}
                    isActive={slide.id === activeSlide.id}
                    isFixed
                    onClick={() => setActiveSlideId(slide.id)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImagePlus className="h-4 w-4" />
              Slide {activeIndex + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isActiveFixed ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Lock className="h-3 w-3 shrink-0" />
                Fixed slide — locked in position. Set its content here; it will appear in every template.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {SCRATCH_LAYOUT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={activeSlide.layout === option.value ? "secondary" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateActiveSlide(
                      option.value === "blank"
                        ? { layout: option.value, title: "", kicker: "", body: "" }
                        : { layout: option.value }
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {!isBlankSlide ? (
                <div className="space-y-2">
                  <Label htmlFor="scratch-kicker">Kicker</Label>
                  <Input
                    id="scratch-kicker"
                    value={activeSlide.kicker}
                    onChange={(event) => updateActiveSlide({ kicker: event.target.value })}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="scratch-bg-color">Background</Label>
                <div className="flex gap-2">
                  <Input
                    id="scratch-bg-color"
                    type="color"
                    value={activeSlide.backgroundColor}
                    onChange={(event) => updateActiveSlide({ backgroundColor: event.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={activeSlide.backgroundColor}
                    onChange={(event) => updateActiveSlide({ backgroundColor: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scratch-slide-text-color" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Font color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="scratch-slide-text-color"
                    type="color"
                    value={activeSlideTextColor}
                    onChange={(event) => updateActiveSlide({ textColor: event.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={activeSlideTextColor}
                    onChange={(event) => updateActiveSlide({ textColor: event.target.value })}
                  />
                </div>
              </div>
            </div>

            {!isBlankSlide ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="scratch-title">Slide title</Label>
                  <Input
                    id="scratch-title"
                    value={activeSlide.title}
                    onChange={(event) => updateActiveSlide({ title: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scratch-body">Body</Label>
                  <Textarea
                    id="scratch-body"
                    value={activeSlide.body}
                    onChange={(event) => updateActiveSlide({ body: event.target.value })}
                    className="min-h-[118px] resize-none"
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Blank slides have no preset text blocks. Set the background, font color, and optional background image.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="scratch-bg-image">Background image</Label>
              <Input
                id="scratch-bg-image"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void handleBackgroundUpload(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              {activeSlide.backgroundImageDataUrl ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="truncate">{activeSlide.backgroundImageName || "Background image added"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      updateActiveSlide({ backgroundImageDataUrl: "", backgroundImageName: "" })
                    }
                    aria-label="Remove background image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={duplicateSlide}
                disabled={isActiveFixed}
                title={isActiveFixed ? "Fixed slides cannot be duplicated" : undefined}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeSlide}
                disabled={isActiveFixed || slides.length <= 1}
                title={isActiveFixed ? "Fixed slides cannot be removed" : undefined}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[720px] xl:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] min-h-[620px]">
            <div className="h-full overflow-auto rounded-md border bg-white p-3">
              <div
                style={{
                  height: previewFrameHeight * PREVIEW_SCALE,
                  width: 1280 * PREVIEW_SCALE,
                }}
              >
                <iframe
                  title="Scratch template preview"
                  srcDoc={previewHtml}
                  className="border-0"
                  sandbox="allow-same-origin"
                  style={{
                    height: previewFrameHeight,
                    transform: `scale(${PREVIEW_SCALE})`,
                    transformOrigin: "top left",
                    width: 1280,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
