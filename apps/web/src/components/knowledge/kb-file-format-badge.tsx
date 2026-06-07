"use client";

import { FileTypeBadgeIcon } from "@/components/knowledge/file-type-badge-icon";
import { resolveKbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";

interface KbFileFormatBadgeProps {
  fileName?: string;
  mimeType?: string;
  className?: string;
}

export function KbFileFormatBadge({ fileName, mimeType, className }: KbFileFormatBadgeProps) {
  const meta = resolveKbFileFormat(fileName, mimeType);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 type-caption font-medium text-muted-foreground",
        className
      )}
    >
      <FileTypeBadgeIcon format={meta.format} size="xs" />
      {meta.label}
    </span>
  );
}

interface KbFileFormatIconProps {
  fileName?: string;
  mimeType?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Large format icon for deck / document list rows. */
export function KbFileFormatIcon({
  fileName,
  mimeType,
  size = "md",
  className,
}: KbFileFormatIconProps) {
  const meta = resolveKbFileFormat(fileName, mimeType);

  return (
    <FileTypeBadgeIcon
      format={meta.format}
      size={size === "sm" ? "sm" : "lg"}
      className={className}
      alt={meta.label}
    />
  );
}
