"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
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
import {
  compactSlidesForSave,
  PARENT_TEMPLATE_MAX_IMAGE_BYTES,
  uploadParentTemplateAsset,
} from "@/lib/content-studio/parent-template-assets";
import { useParentTemplate, useSaveParentTemplate } from "@/lib/data/content-studio-hooks";

const PREVIEW_SCALE = 0.34;

interface FixedSlidesDraft {
  startSlides: ScratchSlideDraft[];
  endSlides: ScratchSlideDraft[];
  accentColor: string;
  textColor: string;
  fontFamily: ScratchTemplateFont;
  logoUrl?: string;
}

function SlideListButton({
  slide,
  index,
  isActive,
  onClick,
}: {
  slide: ScratchSlideDraft;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card hover:bg-muted/40"
      )}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="h-2.5 w-2.5 text-amber-500" />
          Slide {index + 1}
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

export function ParentTemplateBuilder() {
  const { data: existing, isLoading } = useParentTemplate();
  const save = useSaveParentTemplate();

  const [accentColor, setAccentColor] = useState("#2563eb");
  const [textColor, setTextColor] = useState("#0f172a");
  const [fontFamily, setFontFamily] = useState<ScratchTemplateFont>("urbanist");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");

  const [startSlides, setStartSlides] = useState<ScratchSlideDraft[]>(() =>
    createDefaultFixedStartSlides()
  );
  const [endSlides, setEndSlides] = useState<ScratchSlideDraft[]>(() =>
    createDefaultFixedEndSlides()
  );

  const [activeSlideId, setActiveSlideId] = useState(() => startSlides[0]?.id ?? "");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hydratedFromIdRef = useRef<string | null>(null);

  // Hydrate from saved parent template when it loads.
  useEffect(() => {
    if (!existing?.id || !existing.metadata) return;
    const draft = existing.metadata.fixedSlidesDraft as FixedSlidesDraft | undefined;
    if (!draft?.startSlides?.length || !draft.endSlides?.length) return;
    if (hydratedFromIdRef.current === existing.id) return;
    setStartSlides(draft.startSlides);
    setEndSlides(draft.endSlides);
    if (draft.accentColor) setAccentColor(draft.accentColor);
    if (draft.textColor) setTextColor(draft.textColor);
    if (draft.fontFamily) setFontFamily(draft.fontFamily);
    if (draft.logoUrl) {
      setLogoUrl(draft.logoUrl);
      setLogoDataUrl("");
    }
    setActiveSlideId(draft.startSlides[0]?.id ?? draft.endSlides[0]?.id ?? "");
    hydratedFromIdRef.current = existing.id;
  }, [existing]);

  const allSlides = useMemo(() => [...startSlides, ...endSlides], [startSlides, endSlides]);

  const activeIndex = Math.max(
    0,
    allSlides.findIndex((s) => s.id === activeSlideId)
  );
  const activeSlide = allSlides[activeIndex] ?? allSlides[0];
  const activeSlideTextColor = activeSlide?.textColor ?? textColor;
  const isBlankSlide = activeSlide?.layout === "blank";
  const isStartSlide = startSlides.some((s) => s.id === activeSlide?.id);
  const canRemove = !isStartSlide && endSlides.length > 1;

  const logos = useMemo<ScratchLogoAsset[]>(
    () =>
      logoUrl
        ? [{ id: "logo", label: "Logo", dataUrl: "", url: logoUrl, fileName: logoFileName, isPrimary: true }]
        : logoDataUrl
          ? [{ id: "logo", label: "Logo", dataUrl: logoDataUrl, fileName: logoFileName, isPrimary: true }]
          : [],
    [logoDataUrl, logoFileName, logoUrl]
  );

  const compiled = useMemo(
    () =>
      buildScratchTemplateDocument({
        name: "Parent Template",
        accentColor,
        textColor,
        fontFamily,
        tags: [],
        logos,
        fixedStartSlides: startSlides,
        slides: [],
        fixedEndSlides: endSlides,
      }),
    [accentColor, endSlides, fontFamily, logos, startSlides, textColor]
  );
  const previewHtml = useMemo(() => compileTemplateDocument(compiled.html, compiled.css), [compiled]);
  const previewFrameHeight = Math.max(1, allSlides.length) * 740;

  function updateActiveSlide(patch: Partial<ScratchSlideDraft>) {
    const updater = (current: ScratchSlideDraft[]) =>
      current.map((s) => (s.id === activeSlide.id ? { ...s, ...patch } : s));
    if (isStartSlide) setStartSlides(updater);
    else setEndSlides(updater);
  }

  function addEndSlide(layout: ScratchSlideLayout = "section") {
    const next: ScratchSlideDraft = {
      ...createScratchSlide(endSlides.length + 1, layout),
      isFixed: true,
      textColor,
    };
    setEndSlides((c) => [...c, next]);
    setActiveSlideId(next.id);
  }

  function removeActiveEndSlide() {
    if (!canRemove) return;
    setEndSlides((c) => {
      const next = c.filter((s) => s.id !== activeSlide.id);
      const idx = c.findIndex((s) => s.id === activeSlide.id);
      setActiveSlideId(next[Math.max(0, idx - 1)]?.id ?? next[0]?.id ?? startSlides[0]?.id ?? "");
      return next;
    });
  }

  async function handleLogoUpload(file?: File | null) {
    if (!file) return;
    if (!(await validateImageFile(file))) return;
    try {
      const url = await uploadParentTemplateAsset(file);
      setLogoUrl(url);
      setLogoDataUrl("");
      setLogoFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo.");
    }
  }

  async function handleBackgroundUpload(file?: File | null) {
    if (!file) return;
    if (!(await validateImageFile(file))) return;
    try {
      const url = await uploadParentTemplateAsset(file);
      updateActiveSlide({
        backgroundImageUrl: url,
        backgroundImageName: file.name,
        backgroundImageDataUrl: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload background image.");
    }
  }

  async function validateImageFile(file: File): Promise<boolean> {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Use an image file.");
      return false;
    }
    if (file.size > PARENT_TEMPLATE_MAX_IMAGE_BYTES) {
      setError("Image is too large. Maximum size is 52 MB.");
      return false;
    }
    return true;
  }

  async function handleSave() {
    setError("");
    try {
      const draft: FixedSlidesDraft = {
        startSlides: compactSlidesForSave(startSlides),
        endSlides: compactSlidesForSave(endSlides),
        accentColor,
        textColor,
        fontFamily,
        ...(logoUrl ? { logoUrl } : {}),
      };
      const compiledForSave = buildScratchTemplateDocument({
        name: "Parent Template",
        accentColor,
        textColor,
        fontFamily,
        tags: [],
        logos,
        fixedStartSlides: draft.startSlides,
        slides: [],
        fixedEndSlides: draft.endSlides,
      });
      const saved = await save.mutateAsync({
        name: "__parent_template__",
        artifactType: "deck",
        tags: [],
        html: compiledForSave.html,
        css: compiledForSave.css,
        metadata: { isParentTemplate: true, fixedSlidesDraft: draft },
      });
      hydratedFromIdRef.current = saved.id;
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save parent template.");
    }
  }

  if (isLoading) {
    return (
      <PageShell size="wide" className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </PageShell>
    );
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
              <h1 className="text-2xl font-semibold">Parent Template</h1>
              {existing || lastSavedAt ? (
                <Badge variant="default" className="flex items-center gap-1 bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Not saved yet
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Define the{" "}
              <span className="font-medium text-foreground">
                1 cover + {endSlides.length} closing
              </span>{" "}
              fixed slides that are automatically added to <em>every</em> new template.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastSavedAt ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved at {lastSavedAt}
              </span>
            ) : existing ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured — loaded from saved version
              </span>
            ) : (
              <span className="text-xs text-amber-600">Not saved yet — using default slides</span>
            )}
            <Button type="button" onClick={() => void handleSave()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {existing || lastSavedAt ? "Update parent template" : "Save parent template"}
            </Button>
          </div>
        </div>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ── Left — Slides panel ── */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LayoutTemplate className="h-4 w-4" />
              Fixed slides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Global styling */}
            <div className="space-y-2">
              <Label htmlFor="pt-accent" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Accent color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="pt-accent"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-14 p-1"
                />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-text" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Default font color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="pt-text"
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-10 w-14 p-1"
                />
                <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-font" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Font
              </Label>
              <select
                id="pt-font"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as ScratchTemplateFont)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {SCRATCH_FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-logo">Logo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pt-logo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => { void handleLogoUpload(e.target.files?.[0]); e.currentTarget.value = ""; }}
                />
                <Label
                  htmlFor="pt-logo"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-32 cursor-pointer justify-start")}
                >
                  <Upload className="h-4 w-4" />
                  Upload logo
                </Label>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {logoFileName || "No file"}
                </span>
                {logoUrl || logoDataUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setLogoUrl("");
                      setLogoDataUrl("");
                      setLogoFileName("");
                    }}
                    aria-label="Remove logo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Slide list */}
            <div className="space-y-3">
              <Label>Slide list</Label>

              {/* Fixed Start */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                  <Lock className="h-3 w-3" />
                  Cover (start)
                </div>
                {startSlides.map((slide, idx) => (
                  <SlideListButton
                    key={slide.id}
                    slide={slide}
                    index={idx}
                    isActive={slide.id === activeSlide?.id}
                    onClick={() => setActiveSlideId(slide.id)}
                  />
                ))}
              </div>

              {/* Fixed End */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                  <Lock className="h-3 w-3" />
                  Closing slides (end)
                </div>
                {endSlides.map((slide, idx) => (
                  <SlideListButton
                    key={slide.id}
                    slide={slide}
                    index={startSlides.length + idx}
                    isActive={slide.id === activeSlide?.id}
                    onClick={() => setActiveSlideId(slide.id)}
                  />
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full"
                  onClick={() => addEndSlide("section")}
                >
                  <Plus className="h-4 w-4" />
                  Add closing slide
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Middle — Slide editor ── */}
        <Card className="xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImagePlus className="h-4 w-4" />
              Slide {activeIndex + 1}
              {isStartSlide ? (
                <Badge variant="secondary" className="ml-1 flex items-center gap-1 text-[10px]">
                  <Lock className="h-2.5 w-2.5" /> Cover
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-1 flex items-center gap-1 text-[10px]">
                  <Lock className="h-2.5 w-2.5" /> Closing
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Layout picker */}
            <div className="flex flex-wrap gap-2">
              {SCRATCH_LAYOUT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={activeSlide?.layout === option.value ? "secondary" : "outline"}
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
                  <Label htmlFor="pt-kicker">Kicker</Label>
                  <Input
                    id="pt-kicker"
                    value={activeSlide?.kicker ?? ""}
                    onChange={(e) => updateActiveSlide({ kicker: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="pt-bg">Background color</Label>
                <div className="flex gap-2">
                  <Input
                    id="pt-bg"
                    type="color"
                    value={activeSlide?.backgroundColor ?? "#ffffff"}
                    onChange={(e) => updateActiveSlide({ backgroundColor: e.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={activeSlide?.backgroundColor ?? "#ffffff"}
                    onChange={(e) => updateActiveSlide({ backgroundColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-slide-text" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Font color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="pt-slide-text"
                    type="color"
                    value={activeSlideTextColor}
                    onChange={(e) => updateActiveSlide({ textColor: e.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={activeSlideTextColor}
                    onChange={(e) => updateActiveSlide({ textColor: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {!isBlankSlide ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pt-title">Slide title</Label>
                  <Input
                    id="pt-title"
                    value={activeSlide?.title ?? ""}
                    onChange={(e) => updateActiveSlide({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-body">Body</Label>
                  <Textarea
                    id="pt-body"
                    value={activeSlide?.body ?? ""}
                    onChange={(e) => updateActiveSlide({ body: e.target.value })}
                    className="min-h-[118px] resize-none"
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Blank slides have no preset text blocks.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="pt-bg-image">Background image</Label>
              <Input
                id="pt-bg-image"
                type="file"
                accept="image/*"
                onChange={(e) => { void handleBackgroundUpload(e.target.files?.[0]); e.currentTarget.value = ""; }}
              />
              {activeSlide?.backgroundImageDataUrl ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="truncate">{activeSlide.backgroundImageName || "Background image added"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => updateActiveSlide({ backgroundImageDataUrl: "", backgroundImageName: "" })}
                    aria-label="Remove background image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            {!isStartSlide ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeActiveEndSlide}
                disabled={!canRemove}
                title={!canRemove ? "Keep at least one closing slide" : undefined}
              >
                <Trash2 className="h-4 w-4" />
                Remove slide
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Right — Preview ── */}
        <Card className="min-h-[720px] xl:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)] min-h-[620px]">
            <div className="h-full overflow-auto rounded-md border bg-white p-3">
              <div style={{ height: previewFrameHeight * PREVIEW_SCALE, width: 1280 * PREVIEW_SCALE }}>
                <iframe
                  title="Parent template preview"
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
