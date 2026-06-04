import type { KbFileFormat } from "@/lib/kb/file-format";

/** PowerPoint brand icon (PNG in /public/icons; rendered without black matte via KbPowerPointIcon). */
export const POWERPOINT_ICON_SRC = "/icons/powerpoint.png";

export function isPowerPointFormat(format: KbFileFormat): boolean {
  return format === "ppt" || format === "pptx";
}
