import type { LucideIcon } from "lucide-react";
import {
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
  Presentation,
} from "lucide-react";

export type KbFileFormat =
  | "pdf"
  | "ppt"
  | "pptx"
  | "docx"
  | "csv"
  | "png"
  | "jpg"
  | "jpeg"
  | "image"
  | "unknown";

export interface KbFormatMeta {
  format: KbFileFormat;
  label: string;
  icon: LucideIcon;
  canInlinePreview: boolean;
}

const FORMAT_META: Record<KbFileFormat, Omit<KbFormatMeta, "format">> = {
  pdf: { label: "PDF", icon: FileText, canInlinePreview: true },
  ppt: { label: "PowerPoint", icon: Presentation, canInlinePreview: false },
  pptx: { label: "PowerPoint", icon: Presentation, canInlinePreview: false },
  docx: { label: "Word", icon: FileType, canInlinePreview: false },
  csv: { label: "CSV", icon: FileSpreadsheet, canInlinePreview: false },
  png: { label: "Image", icon: ImageIcon, canInlinePreview: true },
  jpg: { label: "Image", icon: ImageIcon, canInlinePreview: true },
  jpeg: { label: "Image", icon: ImageIcon, canInlinePreview: true },
  image: { label: "Image", icon: ImageIcon, canInlinePreview: true },
  unknown: { label: "File", icon: FileType, canInlinePreview: false },
};

export function resolveKbFileFormat(fileName?: string, mimeType?: string): KbFormatMeta {
  const ext = fileName?.includes(".")
    ? (fileName.split(".").pop() ?? "").toLowerCase()
    : "";
  const mime = (mimeType ?? "").toLowerCase();

  let format: KbFileFormat = "unknown";
  if (ext === "pdf" || mime.includes("pdf")) format = "pdf";
  else if (ext === "ppt" || mime.includes("ms-powerpoint")) format = "ppt";
  else if (ext === "pptx" || mime.includes("presentationml")) format = "pptx";
  else if (ext === "docx" || mime.includes("wordprocessingml")) format = "docx";
  else if (ext === "csv" || mime.includes("csv")) format = "csv";
  else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || mime.startsWith("image/"))
    format = ext === "png" || ext === "jpg" || ext === "jpeg" ? (ext as KbFileFormat) : "image";

  const meta = FORMAT_META[format];
  return { format, ...meta };
}

export function kbFileUrl(assetId: string): string {
  return `/api/kb/assets/${encodeURIComponent(assetId)}/file`;
}

export function kbPreviewUrl(assetId: string): string {
  return `/api/kb/assets/${encodeURIComponent(assetId)}/preview`;
}

export function kbSlideMetaUrl(assetId: string): string {
  return `/api/kb/assets/${encodeURIComponent(assetId)}/preview/slides`;
}

export function kbSlideUrl(assetId: string, slideIndex: number): string {
  return `/api/kb/assets/${encodeURIComponent(assetId)}/preview/slides/${slideIndex}`;
}

export function isPresentationFormat(format: KbFileFormat): boolean {
  return format === "ppt" || format === "pptx";
}
