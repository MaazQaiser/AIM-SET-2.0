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
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import type { PostCallEmailAttachmentFound } from "@/lib/brief-types";

interface KbAttachmentCardProps {
  asset: PostCallEmailAttachmentFound;
}

function attachmentFileName(asset: PostCallEmailAttachmentFound) {
  if (asset.fileName) return asset.fileName;
  const suffix = asset.fileType && asset.fileType !== "FILE" ? `.${asset.fileType.toLowerCase()}` : "";
  return `${asset.name}${suffix}`;
}

export function KbAttachmentCard({ asset }: KbAttachmentCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileName = attachmentFileName(asset);
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
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{asset.name}</span>
              <KbFileFormatBadge fileName={fileName} mimeType={asset.mimeType} />
            </div>
            <p className="break-all text-[10px] text-muted-foreground">{fileName}</p>
            {asset.reason ? (
              <p className="text-muted-foreground">{asset.reason}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
              <a href={downloadHref} download={fileName}>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-4 pb-2 pt-4">
            <DialogTitle className="pr-8">{asset.name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <KbFileFormatBadge fileName={fileName} mimeType={asset.mimeType} />
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
