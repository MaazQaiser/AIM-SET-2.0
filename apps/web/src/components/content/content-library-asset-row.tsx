"use client";

import { ChevronRight } from "lucide-react";
import { KbFileFormatIcon } from "@/components/knowledge/kb-file-format-badge";
import { resolveKbFileFormat } from "@/lib/kb/file-format";
import type { KBAsset } from "@/types";
import { cn } from "@/lib/cn";

interface ContentLibraryAssetRowProps {
  asset: KBAsset;
  onSelect: (asset: KBAsset) => void;
  selected?: boolean;
  compact?: boolean;
}

export function ContentLibraryAssetRow({
  asset,
  onSelect,
  selected = false,
  compact = false,
}: ContentLibraryAssetRowProps) {
  const formatMeta = resolveKbFileFormat(asset.fileName, asset.mimeType);
  const status = asset.status ?? "ready";
  const isProcessing = status === "pending" || status === "processing";

  return (
    <button
      type="button"
      disabled={isProcessing}
      onClick={() => onSelect(asset)}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg border text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-2 py-2" : "gap-3 px-3 py-2.5",
        selected
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border/80 bg-card hover:border-primary/30 hover:bg-muted/40",
        isProcessing && "cursor-not-allowed opacity-60"
      )}
    >
      <KbFileFormatIcon
        fileName={asset.fileName}
        mimeType={asset.mimeType}
        size="sm"
        className={compact ? "scale-90" : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
          {asset.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatMeta.label}
          {asset.previewSlideCount ? ` · ${asset.previewSlideCount} slides` : ""}
          {!compact && asset.effectivenessScore !== undefined
            ? ` · ${Math.round(asset.effectivenessScore * 100)}% effective`
            : ""}
        </p>
      </div>
      {!selected && !compact ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
