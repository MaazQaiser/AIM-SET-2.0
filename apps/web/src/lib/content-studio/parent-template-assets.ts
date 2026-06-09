import type { ContentTemplateDraft } from "@/types/content_studio";
import type { ScratchSlideDraft } from "@/lib/content-studio/scratch-template";

export interface TemplateWriteTarget {
  uploadUrl: string;
  parentAssetUploadUrl: string;
  parentSaveUrl: string;
  templateCreateUrl: string;
  templateApiBase: string;
  token: string;
}

export async function prepareTemplateWrite(): Promise<TemplateWriteTarget | null> {
  const res = await fetch("/api/content/templates/upload/prepare", {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<TemplateWriteTarget>;
}

function authHeaders(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function uploadAssetWithProgress(
  file: File,
  target: TemplateWriteTarget | null
): Promise<{ url?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      target?.parentAssetUploadUrl ?? "/api/content/templates/parent/assets"
    );
    const headers = authHeaders(target?.token ?? "");
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = () => {
      // Progress is surfaced by callers when needed.
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}") as { url?: string; detail?: string };
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.detail ?? (xhr.responseText || `Upload failed (${xhr.status})`)));
        }
      } catch {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during image upload."));
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

async function uploadViaBff(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/content/templates/parent/assets", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error((await res.text()) || "Failed to upload image.");
  const payload = (await res.json()) as { url?: string };
  if (!payload.url) throw new Error("Upload did not return an asset URL.");
  return payload.url;
}

export async function uploadParentTemplateAsset(file: File): Promise<string> {
  const target = await prepareTemplateWrite();
  if (target?.parentAssetUploadUrl && target.token) {
    try {
      const payload = await uploadAssetWithProgress(file, target);
      if (payload.url) return payload.url;
    } catch {
      // Fall back to the BFF when the browser cannot reach the API directly.
    }
  }
  return uploadViaBff(file);
}

async function saveViaBff(body: ContentTemplateDraft): Promise<Response> {
  return fetch("/api/content/templates/parent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function saveParentTemplateDirect(
  body: ContentTemplateDraft
): Promise<Response> {
  const target = await prepareTemplateWrite();
  if (target?.parentSaveUrl && target.token) {
    try {
      const direct = await fetch(target.parentSaveUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(target.token),
        },
        body: JSON.stringify(body),
      });
      if (direct.ok) return direct;
    } catch {
      // Fall back to the BFF when the browser cannot reach the API directly.
    }
  }
  return saveViaBff(body);
}

export async function createTemplateDirect(body: ContentTemplateDraft): Promise<Response> {
  const target = await prepareTemplateWrite();
  const url = target?.templateCreateUrl ?? "/api/content/templates";
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(target?.token ?? ""),
    },
    body: JSON.stringify(body),
  });
}

export async function patchTemplateDirect(
  templateId: string,
  body: ContentTemplateDraft
): Promise<Response> {
  const target = await prepareTemplateWrite();
  const url = target?.templateApiBase
    ? `${target.templateApiBase}/${templateId}/direct`
    : `/api/content/templates/${templateId}`;
  return fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(target?.token ?? ""),
    },
    body: JSON.stringify(body),
  });
}

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64 = ""] = dataUrl.split(",", 2);
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName || "image.png", { type: mime });
}

export function compactSlideForSave(slide: ScratchSlideDraft): ScratchSlideDraft {
  const next: ScratchSlideDraft = { ...slide };
  delete next.backgroundImageDataUrl;
  return next;
}

export function compactSlidesForSave(slides: ScratchSlideDraft[]): ScratchSlideDraft[] {
  return slides.map(compactSlideForSave);
}

function slidesNeedImageUpload(slides: ScratchSlideDraft[]): boolean {
  return slides.some((slide) => slide.backgroundImageDataUrl && !slide.backgroundImageUrl);
}

export async function ensureSlideImageUrls(slides: ScratchSlideDraft[]): Promise<ScratchSlideDraft[]> {
  if (!slidesNeedImageUpload(slides)) return slides;
  const next: ScratchSlideDraft[] = [];
  for (const slide of slides) {
    if (slide.backgroundImageDataUrl && !slide.backgroundImageUrl) {
      const file = dataUrlToFile(
        slide.backgroundImageDataUrl,
        slide.backgroundImageName || "background.png"
      );
      const url = await uploadParentTemplateAsset(file);
      next.push({
        ...slide,
        backgroundImageUrl: url,
        backgroundImageDataUrl: undefined,
      });
    } else {
      next.push(slide);
    }
  }
  return next;
}
