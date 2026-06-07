"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { SearchInput } from "@dc-copilot/ui/components/search-input";
import { ContentLibraryColumns } from "@/components/content/content-library-columns";
import { ContentLibrarySplitView } from "@/components/content/content-library-split-view";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { useKbAssets, useKbWatchlist } from "@/lib/data/hooks";
import { usePersona } from "@/hooks/use-persona";
import { groupAssetsByLibraryColumn } from "@/lib/kb/library-categories";
import type { KBAsset } from "@/types";

interface ContentLibraryTabProps {
  onDetailModeChange?: (open: boolean) => void;
}

export function ContentLibraryTab({ onDetailModeChange }: ContentLibraryTabProps) {
  const searchParams = useSearchParams();
  const assetParam = searchParams.get("asset");
  const persona = usePersona();
  const { data: assets = [] } = useKbAssets();
  const { data: watchlist = [] } = useKbWatchlist();
  const [search, setSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.type.toLowerCase().includes(query) ||
        a.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        (a.fileName?.toLowerCase().includes(query) ?? false)
    );
  }, [assets, search]);

  const grouped = useMemo(() => groupAssetsByLibraryColumn(filtered), [filtered]);
  const showWatchlist = persona === "content-owner" || persona === "leadership";

  const selectedAsset = useMemo(
    () => filtered.find((asset) => asset.id === selectedAssetId) ?? null,
    [filtered, selectedAssetId]
  );

  const detailOpen = selectedAsset !== null;

  useEffect(() => {
    if (assetParam) {
      setSelectedAssetId(assetParam);
    }
  }, [assetParam]);

  useEffect(() => {
    onDetailModeChange?.(detailOpen);
  }, [detailOpen, onDetailModeChange]);

  useEffect(() => {
    if (selectedAssetId && !selectedAsset) {
      setSelectedAssetId(null);
    }
  }, [selectedAssetId, selectedAsset]);

  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailOpen]);

  function handleSelectAsset(asset: KBAsset) {
    setSelectedAssetId(asset.id);
  }

  function handleBackToGrid() {
    setSelectedAssetId(null);
  }

  const browseLayout = (
    <div className="space-y-4">
      <SearchInput
        placeholder="Search slide decks, case studies, and other assets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        wrapperClassName="w-full sm:max-w-lg"
        aria-label="Search assets"
      />

      {filtered.length > 0 ? (
        <ContentLibraryColumns grouped={grouped} onSelectAsset={handleSelectAsset} />
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No assets found"
          description="Try a different search or upload a file to the library."
        />
      )}
    </div>
  );

  return (
    <>
      {showWatchlist && !detailOpen ? (
        <Tabs defaultValue="assets" variant="underline">
          <TabsList>
            <TabsTrigger value="assets">Library</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          </TabsList>
          <TabsContent value="assets" className="mt-4">
            {browseLayout}
          </TabsContent>
          <TabsContent value="watchlist" className="mt-4 space-y-3">
            {watchlist.length === 0 ? (
              <p className="type-body text-muted-foreground">No assets flagged for review.</p>
            ) : (
              watchlist.map((item) => (
                <Card key={item.assetId}>
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="type-body font-medium">{item.title}</p>
                      <p className="type-caption text-muted-foreground mt-1">{item.reason}</p>
                    </div>
                    <Badge
                      variant={
                        item.action === "deprecate"
                          ? "destructive"
                          : item.action === "review"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {item.action === "none" ? "OK" : item.action}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      ) : !detailOpen ? (
        browseLayout
      ) : null}

      {selectedAsset ? (
        <ContentLibrarySplitView
          grouped={grouped}
          selectedAsset={selectedAsset}
          search={search}
          onSearchChange={setSearch}
          onSelectAsset={handleSelectAsset}
          onBack={handleBackToGrid}
        />
      ) : null}
    </>
  );
}
