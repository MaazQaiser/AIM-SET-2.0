"use client";

import { use } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, TrendingUp, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Link href="/knowledge" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Knowledge base
        </Link>
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-muted-foreground">Asset not found or could not be loaded.</p>
            <p className="text-xs text-muted-foreground">ID: {assetId}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/knowledge">Back to Knowledge base</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/content/studio">Open Content Studio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Link href="/knowledge" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Knowledge base
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{asset.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {asset.type} · v{asset.version}
            {asset.status && (
              <Badge variant="outline" className="ml-2 capitalize text-[10px]">
                {asset.status}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Asset details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {asset.fileName && <p>File: {asset.fileName}</p>}
          {asset.chunkCount !== undefined && <p>Chunks indexed: {asset.chunkCount}</p>}
          {asset.ingestError && (
            <p className="text-destructive">Ingest error: {asset.ingestError}</p>
          )}
          <p>
            Asset effectiveness and usage data for mid-market financial services prospects.
          </p>
          {asset.effectivenessScore !== undefined && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Effectiveness: {(asset.effectivenessScore * 100).toFixed(0)}%</span>
            </div>
          )}
          {asset.lastUsed && (
            <p className="text-xs">Last used {new Date(asset.lastUsed).toLocaleDateString()}</p>
          )}
        </CardContent>
      </Card>

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
