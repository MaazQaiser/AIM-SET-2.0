"use client";

import { FileTypeBadgeIcon, type FileTypeIconSize } from "@/components/knowledge/file-type-badge-icon";
import { cn } from "@/lib/cn";

interface KbPdfIconProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

const SIZE_MAP: Record<NonNullable<KbPdfIconProps["size"]>, FileTypeIconSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

/** PDF document icon for KB file rows. */
export function KbPdfIcon({ size = "md", className, alt = "PDF" }: KbPdfIconProps) {
  return (
    <FileTypeBadgeIcon
      format="pdf"
      size={SIZE_MAP[size]}
      className={cn("shrink-0", className)}
      alt={alt}
    />
  );
}
