"use client";

import { resolveKbFileFormat, type KbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";

interface KbFileTypeIconProps {
  fileName?: string;
  mimeType?: string;
  format?: KbFileFormat;
  className?: string;
  size?: "sm" | "md";
}

const sizeMap = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
};

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className} aria-hidden>
      <path
        d="M6 0h14.5L28 7.5V38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z"
        fill="#E5252A"
      />
      <path d="M20 0v7.5H28L20 0Z" fill="#fff" fillOpacity="0.35" />
      <text
        x="16"
        y="27"
        textAnchor="middle"
        fill="#fff"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

function WordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className} aria-hidden>
      <path
        d="M6 0h14.5L28 7.5V38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z"
        fill="#2B579A"
      />
      <path d="M20 0v7.5H28L20 0Z" fill="#fff" fillOpacity="0.35" />
      <text
        x="16"
        y="27"
        textAnchor="middle"
        fill="#fff"
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        DOC
      </text>
    </svg>
  );
}

function PowerPointIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className} aria-hidden>
      <path
        d="M6 0h14.5L28 7.5V38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z"
        fill="#D24726"
      />
      <path d="M20 0v7.5H28L20 0Z" fill="#fff" fillOpacity="0.35" />
      <text
        x="16"
        y="27"
        textAnchor="middle"
        fill="#fff"
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        PPT
      </text>
    </svg>
  );
}

function CsvIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className} aria-hidden>
      <path
        d="M6 0h14.5L28 7.5V38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z"
        fill="#217346"
      />
      <path d="M20 0v7.5H28L20 0Z" fill="#fff" fillOpacity="0.35" />
      <text
        x="16"
        y="27"
        textAnchor="middle"
        fill="#fff"
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        CSV
      </text>
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className} aria-hidden>
      <path
        d="M6 0h14.5L28 7.5V38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z"
        fill="#5B6B7C"
      />
      <path d="M20 0v7.5H28L20 0Z" fill="#fff" fillOpacity="0.35" />
      <circle cx="12" cy="18" r="2.5" fill="#fff" fillOpacity="0.9" />
      <path
        d="M8 30l6-7 4 4 6-9 4 12H8Z"
        fill="#fff"
        fillOpacity="0.85"
      />
    </svg>
  );
}

function GenericFileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className} aria-hidden>
      <path
        d="M6 0h14.5L28 7.5V38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z"
        fill="#6B7280"
      />
      <path d="M20 0v7.5H28L20 0Z" fill="#fff" fillOpacity="0.35" />
      <path
        d="M11 22h10M11 26h7"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function iconForFormat(format: KbFileFormat) {
  switch (format) {
    case "pdf":
      return PdfIcon;
    case "docx":
      return WordIcon;
    case "ppt":
    case "pptx":
      return PowerPointIcon;
    case "csv":
      return CsvIcon;
    case "png":
    case "jpg":
    case "jpeg":
    case "image":
      return ImageIcon;
    default:
      return GenericFileIcon;
  }
}

export function KbFileTypeIcon({
  fileName,
  mimeType,
  format: formatOverride,
  className,
  size = "md",
}: KbFileTypeIconProps) {
  const format = formatOverride ?? resolveKbFileFormat(fileName, mimeType).format;
  const Icon = iconForFormat(format);
  const label = resolveKbFileFormat(fileName, mimeType).label;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      title={label}
      aria-hidden
    >
      <Icon className={cn(sizeMap[size], "drop-shadow-sm")} />
    </span>
  );
}
