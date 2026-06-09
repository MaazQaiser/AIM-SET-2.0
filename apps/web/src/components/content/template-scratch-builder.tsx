"use client";

import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  compactSlidesForSave,
  dataUrlToFile,
  ensureSlideImageUrls,
  uploadParentTemplateAsset,
} from "@/lib/content-studio/parent-template-assets";
import { compileTemplateDocument } from "@/lib/content-studio/template-editor";
import {
  useContentTemplate,
  useCreateTemplate,
  useParentTemplate,
  useUpdateTemplate,
} from "@/lib/data/content-studio-hooks";
import type { ContentTemplate } from "@/types/content_studio";

interface ScratchTemplateDraftMeta {
  scratchTemplate?: boolean;
  scratchDraft?: {
    accentColor?: string;
    textColor?: string;
    fontFamily?: ScratchTemplateFont;
    logoUrl?: string;
    logoFileName?: string;
    fixedStartSlides?: ScratchSlideDraft[];
    slides?: ScratchSlideDraft[];
    fixedEndSlides?: ScratchSlideDraft[];
  };
}

interface TemplateScratchBuilderProps {
  templateId?: string;
}

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

function readScratchDraft(template?: ContentTemplate | null): ScratchTemplateDraftMeta["scratchDraft"] {
  const meta = template?.metadata as ScratchTemplateDraftMeta | undefined;
  return meta?.scratchDraft;
}

export function TemplateScratchBuilder({ templateId }: TemplateScratchBuilderProps = {}) {
  const router = useRouter();
  const isEdit = Boolean(templateId);
  const existing = useContentTemplate(templateId);
  const create = useCreateTemplate();
  const update = useUpdateTemplate(templateId);
  const { data: parentTemplate } = useParentTemplate();
  const hydratedFromIdRef = useRef<string | null>(null);
  const [name, setName] = useState("Scratch deck template");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [textColor, setTextColor] = useState("#0f172a");
  const [fontFamily, setFontFamily] = useState<ScratchTemplateFont>("urbanist");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");

  // Fixed slides at the start (1 slide) and end (6 slides) of every template.
  const [fixedStartSlides, setFixedStartSlides] = useState<ScratchSlideDraft[]>(
    () => createDefaultFixedStartSlides()
  );
  const [fixedEndSlides, setFixedEndSlides] = useState<ScratchSlideDraft[]>(
    () => createDefaultFixedEndSlides()
  );

  // User-editable slides between the two fixed groups.
  const [slides, setSlides] = useState<ScratchSlideDraft[]>([createScratchSlide(1)]);

  // Hydrate saved scratch template for editing (name, slides, branding).
  useEffect(() => {
    if (!isEdit || !existing.data?.id) return;
    if (hydratedFromIdRef.current === existing.data.id) return;

    const draft = readScratchDraft(existing.data);
    setName(existing.data.name);
    if (draft?.accentColor) setAccentColor(draft.accentColor);
    if (draft?.textColor) setTextColor(draft.textColor);
    if (draft?.fontFamily) setFontFamily(draft.fontFamily);
    if (draft?.logoUrl) {
      setLogoUrl(draft.logoUrl);
      setLogoDataUrl("");
      setLogoFileName(draft.logoFileName ?? "");
    }
    if (draft?.fixedStartSlides?.length) {
      setFixedStartSlides(draft.fixedStartSlides);
      setActiveSlideId(draft.fixedStartSlides[0]?.id ?? "");
    }
    if (draft?.slides?.length) setSlides(draft.slides);
    if (draft?.fixedEndSlides?.length) setFixedEndSlides(draft.fixedEndSlides);
    hydratedFromIdRef.current = existing.data.id;
  }, [existing.data, isEdit]);

  // When creating a new template, inherit fixed slides from the parent template.
  useEffect(() => {
    if (isEdit) return;
    if (!parentTemplate?.metadata) return;
    const draft = parentTemplate.metadata.fixedSlidesDraft as
      | { startSlides?: ScratchSlideDraft[]; endSlides?: ScratchSlideDraft[] }
      | undefined;
    if (!draft) return;
    if (draft.startSlides?.length) {
      setFixedStartSlides(draft.startSlides);
      setActiveSlideId(draft.startSlides[0].id);
    }
    if (draft.endSlides?.length) setFixedEndSlides(draft.endSlides);
  }, [isEdit, parentTemplate]);

  const allSlides = useMemo(
    () => [...fixedStartSlides, ...slides, ...fixedEndSlides],
    [fixedStartSlides, slides, fixedEndSlides]
  );

  const [activeSlideId, setActiveSlideId] = useState(() => fixedStartSlides[0]?.id ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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
      logoUrl || logoDataUrl
        ? [
            {
              id: "logo",
              label: "Logo",
              dataUrl: logoUrl ? "" : logoDataUrl,
              url: logoUrl || undefined,
              fileName: logoFileName,
              isPrimary: true,
            },
          ]
        : [],
    [logoDataUrl, logoFileName, logoUrl]
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
    if (!file || !(await validateImageFile(file))) return;
    try {
      const url = await uploadParentTemplateAsset(file);
      setLogoUrl(url);
      setLogoDataUrl("");
      setLogoFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo.");
    }
  }

  function removeLogo() {
    setLogoDataUrl("");
    setLogoUrl("");
    setLogoFileName("");
  }

  async function handleBackgroundUpload(file?: File | null) {
    if (!file || !(await validateImageFile(file))) return;
    try {
      const url = await uploadParentTemplateAsset(file);
      updateActiveSlide({
        backgroundImageUrl: url,
        backgroundImageDataUrl: "",
        backgroundImageName: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload background image.");
    }
  }

  async function validateImageFile(file: File): Promise<boolean> {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Use an image file for backgrounds or logos.");
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (isSaving || create.isPending || update.isPending) return;
    setError("");
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (slides.length < 1) {
      setError("Add at least one slide.");
      return;
    }
    setIsSaving(true);
    try {
      let resolvedLogoUrl = logoUrl;
      if (!resolvedLogoUrl && logoDataUrl) {
        resolvedLogoUrl = await uploadParentTemplateAsset(
          dataUrlToFile(logoDataUrl, logoFileName || "logo.png")
        );
        setLogoUrl(resolvedLogoUrl);
        setLogoDataUrl("");
      }
      const preparedStart = await ensureSlideImageUrls(fixedStartSlides);
      const preparedMiddle = await ensureSlideImageUrls(slides);
      const preparedEnd = await ensureSlideImageUrls(fixedEndSlides);
      setFixedStartSlides(preparedStart);
      setSlides(preparedMiddle);
      setFixedEndSlides(preparedEnd);
      const saveLogos: ScratchLogoAsset[] = resolvedLogoUrl
        ? [
            {
              id: "logo",
              label: "Logo",
              dataUrl: "",
              url: resolvedLogoUrl,
              fileName: logoFileName,
              isPrimary: true,
            },
          ]
        : [];
      const compiledForSave = buildScratchTemplateDocument({
        name: name.trim(),
        accentColor,
        textColor,
        fontFamily,
        tags: [],
        logos: saveLogos,
        fixedStartSlides: preparedStart,
        slides: preparedMiddle,
        fixedEndSlides: preparedEnd,
      });
      const payload = {
        name: name.trim(),
        artifactType: "deck" as const,
        tags: [] as string[],
        html: compiledForSave.html,
        css: compiledForSave.css,
        metadata: {
          scratchTemplate: true,
          scratchDraft: {
            accentColor,
            textColor,
            fontFamily,
            ...(resolvedLogoUrl ? { logoUrl: resolvedLogoUrl, logoFileName } : {}),
            fixedStartSlides: compactSlidesForSave(preparedStart),
            slides: compactSlidesForSave(preparedMiddle),
            fixedEndSlides: compactSlidesForSave(preparedEnd),
          },
        },
      };
      const saved = isEdit
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (!isEdit) {
        router.replace(`/content/templates/${saved.id}/scratch`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setIsSaving(false);
    }
  }

  const saving = isSaving || create.isPending || update.isPending;

  if (isEdit && existing.isLoading && !existing.data) {
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
              <h1 className="text-2xl font-semibold">
                {isEdit ? "Edit template" : "Create template from scratch"}
              </h1>
              <Badge variant="secondary">Slide skeleton</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? "Update the template name, slides, and branding, then save."
                : "Build the base slide structure, then choose fonts, add background images, and place logos before saving."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] space-y-1">
              <Label htmlFor="scratch-name-header" className="text-xs text-muted-foreground">
                Template name
              </Label>
              <Input
                id="scratch-name-header"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My deck template"
                disabled={saving}
              />
            </div>
            {lastSavedAt ? (
              <span className="pb-2 text-xs text-muted-foreground">Saved {lastSavedAt}</span>
            ) : null}
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save template"}
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
