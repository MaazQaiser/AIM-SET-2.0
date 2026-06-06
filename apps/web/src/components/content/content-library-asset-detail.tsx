"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { KbAssetPreview } from "@/components/knowledge/kb-asset-preview";
import { KbAssetStatistics } from "@/components/knowledge/kb-asset-statistics";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import type { KBAsset } from "@/types";

export function ContentLibraryAssetDetail({
  asset,
  fillHeight = false,
}: {
  asset: KBAsset;
  fillHeight?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-base font-semibold text-foreground">{asset.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <KbFileFormatBadge fileName={asset.fileName} mimeType={asset.mimeType} />
              <span className="text-xs capitalize text-muted-foreground">
                {asset.type.replace(/-/g, " ")}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/knowledge/${asset.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open full page
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-4 xl:border-r xl:border-border">
          <KbAssetPreview asset={asset} fillHeight={fillHeight} />
        </div>
        <aside className="w-full shrink-0 overflow-y-auto border-t border-border p-4 xl:w-80 xl:border-t-0">
          <KbAssetStatistics asset={asset} />
        </aside>
      </div>
    </div>
  );
}
