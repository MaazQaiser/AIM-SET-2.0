"use client";

import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { KbAssetPreview } from "@/components/knowledge/kb-asset-preview";
import { KbAssetStatistics } from "@/components/knowledge/kb-asset-statistics";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import { useKbAssetSuggestionStats } from "@/lib/data/hooks";
import {
  isPresentationFormat,
  kbFileUrl,
  resolveKbFileFormat,
} from "@/lib/kb/file-format";
import type { KBAsset } from "@/types";

export function ContentLibraryAssetDetail({
  asset,
  fillHeight = false,
}: {
  asset: KBAsset;
  fillHeight?: boolean;
}) {
  const assetTypeLabel = asset.type === "case-study" ? "knowledge asset" : asset.type.replace(/-/g, " ");
  const fileMeta = resolveKbFileFormat(asset.fileName, asset.mimeType);
  const downloadLabel = isPresentationFormat(fileMeta.format) ? "Download PPT" : "Download file";
  const { data: suggestionStats, isLoading: suggestionStatsLoading } =
    useKbAssetSuggestionStats(asset.id);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate type-section-title text-foreground">{asset.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <KbFileFormatBadge fileName={asset.fileName} mimeType={asset.mimeType} />
              <span className="type-caption capitalize text-muted-foreground">
                {assetTypeLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={kbFileUrl(asset.id)} download={asset.fileName ?? asset.title}>
                <Download className="h-3.5 w-3.5" />
                {downloadLabel}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/knowledge/${asset.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open full page
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-4 xl:border-r xl:border-border">
          <KbAssetPreview asset={asset} fillHeight={fillHeight} />
        </div>
        <aside className="w-full shrink-0 overflow-y-auto border-t border-border p-4 xl:w-80 xl:border-t-0">
          <KbAssetStatistics
            asset={asset}
            suggestedLeadCount={suggestionStats?.suggestedLeadCount ?? 0}
            suggestedLeadCountLoading={suggestionStatsLoading}
          />
        </aside>
      </div>
    </div>
  );
}
