import type { ScratchSlideDraft } from "@/lib/content-studio/scratch-template";

/** Matches API upload limit (52 MB). */
export const PARENT_TEMPLATE_MAX_IMAGE_BYTES = 52 * 1024 * 1024;

export async function uploadParentTemplateAsset(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/content/templates/parent/assets", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to upload image.");
  }
  const payload = (await res.json()) as { url?: string };
  if (!payload.url) throw new Error("Upload did not return an asset URL.");
  return payload.url;
}

export function compactSlideForSave(slide: ScratchSlideDraft): ScratchSlideDraft {
  const next: ScratchSlideDraft = { ...slide };
  if (next.backgroundImageUrl) {
    delete next.backgroundImageDataUrl;
  }
  return next;
}

export function compactSlidesForSave(slides: ScratchSlideDraft[]): ScratchSlideDraft[] {
  return slides.map(compactSlideForSave);
}
