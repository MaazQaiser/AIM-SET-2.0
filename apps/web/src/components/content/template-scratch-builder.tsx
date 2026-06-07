"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Copy,
  Eye,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Palette,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { cn } from "@dc-copilot/ui/lib/cn";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import {
  buildScratchTemplateDocument,
  createScratchSlide,
  parseScratchTags,
  SCRATCH_LAYOUT_OPTIONS,
  type ScratchSlideDraft,
  type ScratchSlideLayout,
} from "@/lib/content-studio/scratch-template";
import { compileTemplateDocument } from "@/lib/content-studio/template-editor";
import { useCreateTemplate } from "@/lib/data/content-studio-hooks";

const MAX_IMAGE_BYTES = 3_500_000;

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

export function TemplateScratchBuilder() {
  const create = useCreateTemplate();
  const [name, setName] = useState("Scratch deck template");
  const [tagsText, setTagsText] = useState("scratch, deck");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoName, setLogoName] = useState("");
  const [slides, setSlides] = useState<ScratchSlideDraft[]>([createScratchSlide(1)]);
  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.id ?? "");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activeSlideId)
  );
  const activeSlide = slides[activeIndex] ?? slides[0];

  const compiled = useMemo(
    () =>
      buildScratchTemplateDocument({
        name,
        accentColor,
        tags: parseScratchTags(tagsText),
        logoDataUrl,
        logoName,
        slides,
      }),
    [accentColor, logoDataUrl, logoName, name, slides, tagsText]
  );
  const previewHtml = useMemo(() => compileTemplateDocument(compiled.html, compiled.css), [compiled]);

  function updateActiveSlide(patch: Partial<ScratchSlideDraft>) {
    setSlides((current) =>
      current.map((slide) => (slide.id === activeSlide.id ? { ...slide, ...patch } : slide))
    );
  }

  function addSlide(layout: ScratchSlideLayout = "section") {
    const next = createScratchSlide(slides.length + 1, layout);
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
    if (slides.length <= 1) return;
    setSlides((current) => {
      const nextSlides = current.filter((slide) => slide.id !== activeSlide.id);
      setActiveSlideId(nextSlides[Math.max(0, activeIndex - 1)]?.id ?? nextSlides[0]?.id ?? "");
      return nextSlides;
    });
  }

  async function handleLogoUpload(file?: File | null) {
    if (!file) return;
    const dataUrl = await readCheckedImage(file);
    if (!dataUrl) return;
    setLogoDataUrl(dataUrl);
    setLogoName(file.name);
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
        tags: parseScratchTags(tagsText),
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
              Build the base slide structure, then add background images and a logo before saving.
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
              <Label htmlFor="scratch-tags">Tags</Label>
              <Input
                id="scratch-tags"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="enterprise, pitch, vertical"
              />
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
              <Label htmlFor="scratch-logo">Logo</Label>
              <Input
                id="scratch-logo"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void handleLogoUpload(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              {logoDataUrl ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="truncate">{logoName || "Logo added"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setLogoDataUrl("");
                      setLogoName("");
                    }}
                    aria-label="Remove logo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Slide list</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addSlide()}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      slide.id === activeSlide.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card hover:bg-muted/40"
                    )}
                    onClick={() => setActiveSlideId(slide.id)}
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] font-medium text-muted-foreground">
                        Slide {index + 1}
                      </span>
                      <span className="block truncate font-medium">{slide.title || "Untitled"}</span>
                    </span>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {slide.layout.replace(/_/g, " ")}
                    </Badge>
                  </button>
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
            <div className="flex flex-wrap gap-2">
              {SCRATCH_LAYOUT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={activeSlide.layout === option.value ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => updateActiveSlide({ layout: option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="scratch-kicker">Kicker</Label>
                <Input
                  id="scratch-kicker"
                  value={activeSlide.kicker}
                  onChange={(event) => updateActiveSlide({ kicker: event.target.value })}
                />
              </div>
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
            </div>

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
              <Button type="button" variant="outline" size="sm" onClick={duplicateSlide}>
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeSlide}
                disabled={slides.length <= 1}
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
            <div className="h-full overflow-hidden rounded-md border bg-white">
              <iframe
                title="Scratch template preview"
                srcDoc={previewHtml}
                className="h-full w-full"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/content/templates/upload">
            <Upload className="h-4 w-4" />
            Upload instead
          </Link>
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save template
        </Button>
      </div>
    </PageShell>
  );
}
