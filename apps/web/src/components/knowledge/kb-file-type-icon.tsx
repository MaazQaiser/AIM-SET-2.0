"use client";

import { FileTypeBadgeIcon, FILE_TYPE_ICON_SIZE } from "@/components/knowledge/file-type-badge-icon";
import { resolveKbFileFormat, type KbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";

interface KbFileTypeIconProps {
  fileName?: string;
  mimeType?: string;
  format?: KbFileFormat;
  className?: string;
  size?: "sm" | "md";
}

export function KbFileTypeIcon({
  fileName,
  mimeType,
  format: formatOverride,
  className,
  size = "md",
}: KbFileTypeIconProps) {
  const format = formatOverride ?? resolveKbFileFormat(fileName, mimeType).format;
  const label = resolveKbFileFormat(fileName, mimeType).label;

  return (
    <FileTypeBadgeIcon
      format={format}
      size={size === "sm" ? "sm" : "md"}
      className={cn("drop-shadow-sm", className)}
      alt={label}
    />
  );
}

export { FILE_TYPE_ICON_SIZE };
