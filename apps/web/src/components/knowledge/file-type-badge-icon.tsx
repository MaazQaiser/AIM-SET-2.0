"use client";

import { cn } from "@/lib/cn";
import type { KbFileFormat } from "@/lib/kb/file-format";

/** Flat document + white label badge — Google Drive / Material style (HD SVG). */
const FILE_TYPE_STYLES: Record<
  string,
  { fill: string; fold: string; label: string; text: string }
> = {
  pdf: { fill: "#E94235", fold: "#F28B82", label: "PDF", text: "#E94235" },
  doc: { fill: "#4285F4", fold: "#8AB4F8", label: "DOC", text: "#4285F4" },
  docx: { fill: "#4285F4", fold: "#8AB4F8", label: "DOC", text: "#4285F4" },
  xls: { fill: "#34A853", fold: "#81C995", label: "XLS", text: "#34A853" },
  csv: { fill: "#34A853", fold: "#81C995", label: "CSV", text: "#34A853" },
  ppt: { fill: "#F4B400", fold: "#FDE293", label: "PPT", text: "#E37400" },
  pptx: { fill: "#F4B400", fold: "#FDE293", label: "PPT", text: "#E37400" },
  png: { fill: "#5F6368", fold: "#9AA0A6", label: "IMG", text: "#5F6368" },
  jpg: { fill: "#5F6368", fold: "#9AA0A6", label: "IMG", text: "#5F6368" },
  jpeg: { fill: "#5F6368", fold: "#9AA0A6", label: "IMG", text: "#5F6368" },
  image: { fill: "#5F6368", fold: "#9AA0A6", label: "IMG", text: "#5F6368" },
  file: { fill: "#80868B", fold: "#BDC1C6", label: "FILE", text: "#80868B" },
};

export const FILE_TYPE_ICON_SIZE = {
  xs: "h-[18px] w-[15px]",
  sm: "h-[22px] w-[19px]",
  md: "h-8 w-[27px]",
  lg: "h-11 w-[37px]",
  xl: "h-14 w-[47px]",
} as const;

export type FileTypeIconSize = keyof typeof FILE_TYPE_ICON_SIZE;

function resolveFileTypeKey(format: KbFileFormat): keyof typeof FILE_TYPE_STYLES {
  if (format in FILE_TYPE_STYLES) return format;
  return "file";
}

interface FileTypeBadgeIconProps {
  format: KbFileFormat;
  size?: FileTypeIconSize;
  className?: string;
  alt?: string;
}

export function FileTypeBadgeIcon({
  format,
  size = "md",
  className,
  alt,
}: FileTypeBadgeIconProps) {
  const key = resolveFileTypeKey(format);
  const style = FILE_TYPE_STYLES[key];
  const label = style.label;
  const fontSize = label.length > 3 ? 7.5 : 9;

  return (
    <svg
      viewBox="0 0 48 56"
      fill="none"
      role="img"
      aria-label={alt ?? `${label} file`}
      className={cn(FILE_TYPE_ICON_SIZE[size], "shrink-0", className)}
    >
      <path
        d="M8 2h20.5a2 2 0 0 1 1.4.6l10.1 10.1A2 2 0 0 1 41 14.7V50a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"
        fill={style.fill}
      />
      <path
        d="M28.5 2v10.2a2 2 0 0 0 2 2H41L28.5 2z"
        fill={style.fold}
      />
      <rect x="9" y="24" width="30" height="18" rx="4" fill="#fff" />
      <text
        x="24"
        y="36.5"
        textAnchor="middle"
        fill={style.text}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        letterSpacing="-0.02em"
      >
        {label}
      </text>
    </svg>
  );
}
