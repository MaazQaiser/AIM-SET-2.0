"use client";

import { FileTypeBadgeIcon, type FileTypeIconSize } from "@/components/knowledge/file-type-badge-icon";
import { cn } from "@/lib/cn";

interface KbPowerPointIconProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

const SIZE_MAP: Record<NonNullable<KbPowerPointIconProps["size"]>, FileTypeIconSize> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
};

/** PowerPoint document icon for KB file rows. */
export function KbPowerPointIcon({
  size = "md",
  className,
  alt = "PowerPoint",
}: KbPowerPointIconProps) {
  return (
    <FileTypeBadgeIcon
      format="pptx"
      size={SIZE_MAP[size]}
      className={cn("shrink-0", className)}
      alt={alt}
    />
  );
}
