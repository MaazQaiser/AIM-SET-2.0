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
import type { RelevantDocument } from "@/lib/brief-types";

interface KbDocumentViewerDialogProps {
  document: RelevantDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KbDocumentViewerDialog({
  document: doc,
  open,
  onOpenChange,
}: KbDocumentViewerDialogProps) {
  if (!doc) return null;

  const asset = {
    id: doc.assetId,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    status: "ready" as const,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="pr-8 truncate">{doc.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <KbFileFormatBadge fileName={doc.fileName} mimeType={doc.mimeType} />
            {doc.relevanceScore !== undefined && (
              <span>{Math.round(doc.relevanceScore * 100)}% relevance</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
          <KbAssetPreview asset={asset} indexedText={doc.previewText ?? doc.snippet} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
