"use client";

import { resolveKbFileFormat, type KbFileFormat } from "@/lib/kb/file-format";
import { isPowerPointFormat } from "@/lib/kb/format-brand-icons";
import { KbPowerPointIcon } from "@/components/knowledge/kb-powerpoint-icon";
import { cn } from "@/lib/cn";

interface KbFileFormatBadgeProps {
  fileName?: string;
  mimeType?: string;
  className?: string;
}

const FORMAT_ICON_SURFACE: Record<KbFileFormat, string> = {
  pdf: "border-red-200/80 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  ppt: "",
  pptx: "",
  docx: "border-blue-200/80 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  csv: "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  png: "border-violet-200/80 bg-violet-50 text-violet-700",
  jpg: "border-violet-200/80 bg-violet-50 text-violet-700",
  jpeg: "border-violet-200/80 bg-violet-50 text-violet-700",
  image: "border-violet-200/80 bg-violet-50 text-violet-700",
  unknown: "border-border/80 bg-muted/50 text-muted-foreground",
};

export function KbFileFormatBadge({ fileName, mimeType, className }: KbFileFormatBadgeProps) {
  const meta = resolveKbFileFormat(fileName, mimeType);
  const Icon = meta.icon;
  const isPpt = isPowerPointFormat(meta.format);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        isPpt && "border-transparent bg-transparent px-0 py-0 normal-case tracking-normal",
        className
      )}
    >
      {isPpt ? (
        <KbPowerPointIcon size="xs" className="h-3.5 w-3.5" />
      ) : (
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
      )}
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

/** Large format icon for deck / document list rows (PowerPoint, PDF, CSV, etc.). */
export function KbFileFormatIcon({
  fileName,
  mimeType,
  size = "md",
  className,
}: KbFileFormatIconProps) {
  const meta = resolveKbFileFormat(fileName, mimeType);
  const Icon = meta.icon;

  if (isPowerPointFormat(meta.format)) {
    return (
      <KbPowerPointIcon
        size={size === "sm" ? "sm" : "md"}
        className={className}
        alt={meta.label}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border",
        FORMAT_ICON_SURFACE[meta.format],
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        className
      )}
      title={meta.label}
      aria-hidden
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </div>
  );
}
