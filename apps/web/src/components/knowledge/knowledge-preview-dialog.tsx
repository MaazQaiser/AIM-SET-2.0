"use client";

import {
  Dialog,
  DialogContent,
} from "@dc-copilot/ui/components/dialog";
import { briefDetailDialogClass } from "@/components/pre-call/brief-detail-card";
import { ContentLibraryAssetDetail } from "@/components/content/content-library-asset-detail";
import type { KBAsset } from "@/types";
import { cn } from "@/lib/cn";

interface KnowledgePreviewDialogProps {
  asset: KBAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgePreviewDialog({ asset, open, onOpenChange }: KnowledgePreviewDialogProps) {
  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          briefDetailDialogClass,
          "max-w-6xl w-[96vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        )}
      >
        <ContentLibraryAssetDetail asset={asset} />
      </DialogContent>
    </Dialog>
  );
}
