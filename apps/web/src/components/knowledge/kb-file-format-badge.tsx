"use client";

import { resolveKbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";

interface KbFileFormatBadgeProps {
  fileName?: string;
  mimeType?: string;
  className?: string;
}

export function KbFileFormatBadge({ fileName, mimeType, className }: KbFileFormatBadgeProps) {
  const meta = resolveKbFileFormat(fileName, mimeType);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}
