"use client";

import { use } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { KbAssetPreview } from "@/components/knowledge/kb-asset-preview";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import { useKbAsset } from "@/lib/data/hooks";

export default function KnowledgeAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const { data: asset, isLoading } = useKbAsset(assetId);
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Link href="/knowledge" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Knowledge base
        </Link>
        <p className="text-muted-foreground">Asset not found or could not be loaded.</p>
      </div>
    );
  }

  const onReEmbed = async () => {
    const res = await fetch(`/api/kb/assets/${assetId}/re-embed`, { method: "POST" });
    if (!res.ok) {
      toast.error("Re-embed failed");
      return;
    }
    toast.success("Re-embed queued");
    await queryClient.invalidateQueries({ queryKey: ["kb-asset", assetId] });
  };

  const onDelete = async () => {
    if (!confirm("Delete this asset and all chunks?")) return;
    const res = await fetch(`/api/kb/assets/${assetId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Asset deleted");
    window.location.href = "/knowledge";
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link href="/knowledge" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Knowledge base
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold truncate">{asset.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <KbFileFormatBadge fileName={asset.fileName} mimeType={asset.mimeType} />
            <span className="text-xs text-muted-foreground capitalize">{asset.type} · v{asset.version}</span>
            {asset.status && asset.status !== "ready" && (
              <Badge variant="outline" className="capitalize text-[10px]">
                {asset.status}
              </Badge>
            )}
          </div>
          {asset.fileName && <p className="text-xs text-muted-foreground">{asset.fileName}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void onReEmbed()}>
            <RefreshCw className="h-4 w-4" />
            Re-embed
          </Button>
          <Button variant="outline" size="sm" onClick={() => void onDelete()}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <KbAssetPreview asset={asset} />

      {asset.chunkCount !== undefined && (
        <p className="text-xs text-muted-foreground">Chunks indexed: {asset.chunkCount}</p>
      )}
      {asset.ingestError && <p className="text-sm text-destructive">Ingest error: {asset.ingestError}</p>}

      <div className="flex flex-wrap gap-1">
        {asset.tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
