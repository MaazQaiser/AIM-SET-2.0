"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useKbAsset } from "@/lib/data/hooks";

export default function KnowledgeAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const { data: asset } = useKbAsset(assetId);

  if (!asset) return null;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Link href="/knowledge" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Knowledge base
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{asset.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {asset.type} · v{asset.version}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">One-page summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Asset effectiveness and usage data for mid-market financial services prospects. Used when prospects
            mention compliance, SOC 2, or regulatory reporting velocity.
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
