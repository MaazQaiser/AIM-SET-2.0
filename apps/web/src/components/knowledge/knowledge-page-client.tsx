"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { KBAssetCard } from "@/components/kb-asset-card";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { KnowledgePreviewDialog } from "@/components/knowledge/knowledge-preview-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { FilterChip } from "@/components/ui/chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useKbAssets, useKbWatchlist } from "@/lib/data/hooks";
import { usePersona } from "@/hooks/use-persona";
import type { KBAsset } from "@/types";

const filterTypes = ["All", "Deck", "Case Study", "Image", "Architecture Diagram", "Battle Card", "OnePager"];

const normalizeType = (value: string) => value.toLowerCase().replace(/[\s-]/g, "");

export function KnowledgePageClient() {
  const persona = usePersona();
  const { data: assets = [] } = useKbAssets();
  const { data: watchlist = [] } = useKbWatchlist();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [previewAsset, setPreviewAsset] = useState<KBAsset | null>(null);

  const filtered = assets.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || normalizeType(a.type).includes(normalizeType(filter));
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Knowledge base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {assets.length} assets
            {process.env.NEXT_PUBLIC_KB_SHARED === "true" && (
              <span className="ml-1">· Shared team library</span>
            )}
          </p>
        </div>
        <KbUploadButton />
      </div>

      <Tabs defaultValue={persona === "content-owner" ? "watchlist" : "library"} variant="underline">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          {(persona === "content-owner" || persona === "leadership") && (
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="library" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3">
            <SearchInput
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="w-full sm:max-w-md"
              aria-label="Search assets"
            />
            <div className="flex flex-wrap gap-1.5">
              {filterTypes.map((type) => (
                <FilterChip key={type} active={type === filter} onClick={() => setFilter(type)}>
                  {type}
                </FilterChip>
              ))}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((asset) => (
                <KBAssetCard key={asset.id} asset={asset} onPreview={setPreviewAsset} />
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No assets found" description="Try a different search or filter." />
          )}
        </TabsContent>

        <TabsContent value="watchlist" className="mt-4 space-y-3">
          {watchlist.map((item) => (
            <Card key={item.assetId}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                </div>
                <Badge
                  variant={
                    item.action === "deprecate" ? "destructive" : item.action === "review" ? "warning" : "secondary"
                  }
                >
                  {item.action === "none" ? "OK" : item.action}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <KnowledgePreviewDialog
        asset={previewAsset}
        open={previewAsset !== null}
        onOpenChange={(open) => !open && setPreviewAsset(null)}
      />
    </div>
  );
}
