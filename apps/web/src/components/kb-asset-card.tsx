"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Eye, ExternalLink, TrendingUp } from "lucide-react";
import { Chip } from "@dc-copilot/ui/components/chip";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import type { KBAsset } from "@/types";

function EffectivenessBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${score * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
    </div>
  );
}

interface KBAssetCardProps {
  asset: KBAsset;
  onPreview?: (asset: KBAsset) => void;
}

export function KBAssetCard({ asset, onPreview }: KBAssetCardProps) {
  const status = asset.status ?? "ready";

  return (
    <Card className="hover:shadow-soft-sm transition-shadow h-full flex flex-col">
      <CardContent className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start justify-between gap-2">
          <KbFileFormatBadge fileName={asset.fileName} mimeType={asset.mimeType} />
          {status !== "ready" && (
            <Badge
              variant={status === "failed" ? "destructive" : "secondary"}
              className="text-[9px] capitalize shrink-0"
            >
              {status}
            </Badge>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground line-clamp-2">{asset.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {asset.type} · v{asset.version}
          </p>
          {asset.fileName && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate" title={asset.fileName}>
              {asset.fileName}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {asset.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} variant="tag">
              {tag}
            </Chip>
          ))}
          {asset.tags.length > 3 && <Chip variant="muted">+{asset.tags.length - 3}</Chip>}
        </div>

        {asset.effectivenessScore !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Effectiveness
            </div>
            <EffectivenessBar score={asset.effectivenessScore} />
          </div>
        )}

        {asset.lastUsed && (
          <p className="text-xs text-muted-foreground">
            Last used {format(new Date(asset.lastUsed), "MMM d")}
          </p>
        )}

        <div className="flex gap-2 pt-1 mt-auto border-t border-border/60">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 flex-1 text-xs"
            disabled={status === "pending" || status === "processing"}
            onClick={() => onPreview?.(asset)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" asChild>
            <Link href={`/knowledge/${asset.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Open
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
