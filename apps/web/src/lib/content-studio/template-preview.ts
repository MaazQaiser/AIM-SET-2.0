import { isPresentationFormat, resolveKbFileFormat } from "@/lib/kb/file-format";

export function templateFileUrl(templateId: string): string {
  return `/api/content/templates/${encodeURIComponent(templateId)}/file`;
}

export function templateSlideUrl(templateId: string, slideIndex: number): string {
  return `/api/content/templates/${encodeURIComponent(templateId)}/slides/${slideIndex}`;
}

export function templatePreviewPdfUrl(templateId: string): string {
  return `/api/content/templates/${encodeURIComponent(templateId)}/preview`;
}

function inferSourceFileName(template: {
  sourceFileName?: string;
  name?: string;
  artifactType?: string;
}) {
  if (template.sourceFileName?.trim()) return template.sourceFileName.trim();
  const lowerName = template.name?.toLowerCase() ?? "";
  if (lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")) return template.name!;
  if (lowerName.endsWith(".pdf")) return template.name!;
  if (template.artifactType === "deck" || template.artifactType === "case_study") {
    return "template.ppt";
  }
  if (template.artifactType === "one_pager") return "template.pdf";
  return "template.bin";
}

export function resolveTemplatePreviewMode(template: {
  sourceFileName?: string;
  hasSourceFile?: boolean;
  previewSlideCount?: number;
  pageCount?: number;
  artifactType?: string;
  name?: string;
}) {
  const slideCount = template.previewSlideCount ?? template.pageCount ?? 0;
  const likelyUpload =
    Boolean(template.hasSourceFile) ||
    (slideCount > 0 && (template.artifactType === "deck" || template.artifactType === "case_study"));

  if (!likelyUpload) {
    return { mode: "html" as const };
  }

  const sourceFileName = inferSourceFileName(template);
  const meta = resolveKbFileFormat(sourceFileName);

  if (isPresentationFormat(meta.format) && slideCount > 0) {
    return {
      mode: "slides" as const,
      slideCount,
      format: meta.format,
      fileName: sourceFileName,
    };
  }

  if (meta.format === "pdf") {
    return { mode: "pdf" as const, fileName: sourceFileName };
  }

  if (meta.canInlinePreview) {
    return { mode: "image" as const, fileName: sourceFileName };
  }

  return { mode: "download" as const, fileName: sourceFileName, format: meta.format };
}
