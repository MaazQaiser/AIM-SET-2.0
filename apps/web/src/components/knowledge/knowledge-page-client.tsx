"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { SearchInput } from "@/components/ui/search-input";
import { KBAssetCard } from "@/components/kb-asset-card";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { FilterChip } from "@/components/ui/chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useKbAssets, useKbWatchlist } from "@/lib/data/hooks";
import { usePersona } from "@/hooks/use-persona";

const filterTypes = ["All", "Deck", "Case Study", "Architecture", "Battlecard", "One-Pager"];

export function KnowledgePageClient() {
  const persona = usePersona();
  const { data: assets = [] } = useKbAssets();
  const { data: watchlist = [] } = useKbWatchlist();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const filtered = assets.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "All" || a.type.replace("-", " ").toLowerCase().includes(filter.toLowerCase().replace("-", " "));
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
                <FilterChip
                  key={type}
                  active={type === filter}
                  onClick={() => setFilter(type)}
                >
                  {type}
                </FilterChip>
              ))}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((asset) => (
                <Link key={asset.id} href={`/knowledge/${asset.id}`}>
                  <KBAssetCard asset={asset} />
                </Link>
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
    </div>
  );
}
