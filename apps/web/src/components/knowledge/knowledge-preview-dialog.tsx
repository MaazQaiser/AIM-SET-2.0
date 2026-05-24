"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { KbAssetPreview } from "@/components/knowledge/kb-asset-preview";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import type { KBAsset } from "@/types";

interface KnowledgePreviewDialogProps {
  asset: KBAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgePreviewDialog({ asset, open, onOpenChange }: KnowledgePreviewDialogProps) {
  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="pr-8 truncate">{asset.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <KbFileFormatBadge fileName={asset.fileName} mimeType={asset.mimeType} />
            {asset.fileName && <span className="truncate">{asset.fileName}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
          <KbAssetPreview asset={asset} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
