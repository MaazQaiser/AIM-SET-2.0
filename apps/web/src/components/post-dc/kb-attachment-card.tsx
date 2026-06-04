"use client";

import { useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { KbAssetPreview } from "@/components/knowledge/kb-asset-preview";
import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { resolveKbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";
import type { PostCallEmailAttachmentFound } from "@/lib/brief-types";

interface KbAttachmentCardProps {
  asset: PostCallEmailAttachmentFound;
  /** Flat list row — no fill, no radius, bottom divider only */
  variant?: "card" | "list";
}

function attachmentFileName(asset: PostCallEmailAttachmentFound) {
  if (asset.fileName) return asset.fileName;
  const suffix = asset.fileType && asset.fileType !== "FILE" ? `.${asset.fileType.toLowerCase()}` : "";
  return `${asset.name}${suffix}`;
}

function formatMatchScore(score?: number): string | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `${pct}% match`;
}

export function KbAttachmentCard({ asset, variant = "list" }: KbAttachmentCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileName = attachmentFileName(asset);
  const formatMeta = resolveKbFileFormat(fileName, asset.mimeType);
  const matchLabel = formatMatchScore(asset.matchScore);
  const downloadHref = asset.downloadUrl ?? `/api/kb/assets/${asset.assetId}/file`;
  const previewAsset = useMemo(
    () => ({
      id: asset.assetId,
      title: asset.name,
      fileName,
      mimeType: asset.mimeType,
      status: "ready" as const,
      hasPreview: Boolean(asset.previewUrl),
    }),
    [asset.assetId, asset.mimeType, asset.name, asset.previewUrl, fileName]
  );

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3",
          variant === "list"
            ? "rounded-none bg-transparent px-0 py-0"
            : "rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-colors hover:border-border/80 hover:bg-muted/20"
        )}
      >
        <KbFileTypeIcon fileName={fileName} mimeType={asset.mimeType} size="md" />

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-foreground">{asset.name}</p>
            {matchLabel ? (
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                {matchLabel}
              </span>
            ) : null}
          </div>
          {variant === "list" && asset.reason ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground/80">Why it matched:</span> {asset.reason}
            </p>
          ) : (
            <p className="truncate text-[11px] text-muted-foreground">{fileName}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewOpen(true)}
                aria-label={`Preview ${asset.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Preview</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <a href={downloadHref} download={fileName} aria-label={`Download ${fileName}`}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Download</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-4 pb-2 pt-4">
            <DialogTitle className="flex items-center gap-2 pr-8">
              <KbFileTypeIcon fileName={fileName} mimeType={asset.mimeType} size="sm" />
              <span className="truncate">{asset.name}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {formatMeta.label}
              </span>
              <span className="break-all">{fileName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            <KbAssetPreview asset={previewAsset} indexedText={asset.snippet} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
