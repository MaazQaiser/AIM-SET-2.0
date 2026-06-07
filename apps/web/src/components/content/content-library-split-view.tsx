"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { SearchInput } from "@dc-copilot/ui/components/search-input";
import { ContentLibraryAssetDetail } from "@/components/content/content-library-asset-detail";
import { ContentLibraryAssetRow } from "@/components/content/content-library-asset-row";
import { LIBRARY_COLUMN_META } from "@/components/content/content-library-columns";
import type { LibraryColumnId } from "@/lib/kb/library-categories";
import type { KBAsset } from "@/types";

interface ContentLibrarySplitViewProps {
  grouped: Record<LibraryColumnId, KBAsset[]>;
  selectedAsset: KBAsset;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectAsset: (asset: KBAsset) => void;
  onBack: () => void;
}

export function ContentLibrarySplitView({
  grouped,
  selectedAsset,
  search,
  onSearchChange,
  onSelectAsset,
  onBack,
}: ContentLibrarySplitViewProps) {
  const columnIds = (Object.keys(LIBRARY_COLUMN_META) as LibraryColumnId[]).filter(
    (id) => grouped[id].length > 0
  );

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex bg-background"
      style={{ left: "calc(var(--sidebar-rail-width, 64px) + 1rem)" }}
    >
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card">
        <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
            All assets
          </Button>
          <SearchInput
            placeholder="Search assets..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            wrapperClassName="w-full"
            aria-label="Search assets"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {columnIds.map((columnId) => {
            const meta = LIBRARY_COLUMN_META[columnId];
            const Icon = meta.icon;
            const assets = grouped[columnId];

            return (
              <section key={columnId} className="mb-4 last:mb-0">
                <div className="sticky top-0 z-[1] mb-1.5 flex items-center gap-2 bg-card px-2 py-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <h3 className="type-kicker text-muted-foreground">
                    {meta.title}
                  </h3>
                  <span className="type-caption tabular-nums text-muted-foreground">{assets.length}</span>
                </div>
                <div className="space-y-1">
                  {assets.map((asset) => (
                    <ContentLibraryAssetRow
                      key={asset.id}
                      asset={asset}
                      selected={asset.id === selectedAsset.id}
                      compact
                      onSelect={onSelectAsset}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <ContentLibraryAssetDetail asset={selectedAsset} fillHeight />
      </main>
    </div>
  );
}
