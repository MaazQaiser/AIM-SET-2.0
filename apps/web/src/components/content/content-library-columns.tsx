"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpen, Layers, Presentation } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { ContentLibraryAssetRow } from "@/components/content/content-library-asset-row";
import type { LibraryColumnId } from "@/lib/kb/library-categories";
import type { KBAsset } from "@/types";
import { cn } from "@/lib/cn";

export const LIBRARY_COLUMN_META: Record<
  LibraryColumnId,
  { title: string; icon: LucideIcon; emptyMessage: string }
> = {
  "slide-decks": {
    title: "Slide Decks",
    icon: Presentation,
    emptyMessage: "No slide decks in the library yet.",
  },
  "case-studies": {
    title: "Case Studies",
    icon: BookOpen,
    emptyMessage: "No case studies in the library yet.",
  },
  others: {
    title: "Others",
    icon: Layers,
    emptyMessage: "No other assets in the library yet.",
  },
};

interface ContentLibraryColumnProps {
  columnId: LibraryColumnId;
  assets: KBAsset[];
  onSelectAsset: (asset: KBAsset) => void;
  className?: string;
}

export function ContentLibraryColumn({
  columnId,
  assets,
  onSelectAsset,
  className,
}: ContentLibraryColumnProps) {
  const meta = LIBRARY_COLUMN_META[columnId];
  const Icon = meta.icon;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card/50",
        className
      )}
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{meta.title}</h3>
          <p className="text-[11px] text-muted-foreground">
            {assets.length} asset{assets.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {assets.length}
        </Badge>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {assets.length > 0 ? (
          <div className="space-y-2">
            {assets.map((asset) => (
              <ContentLibraryAssetRow key={asset.id} asset={asset} onSelect={onSelectAsset} />
            ))}
          </div>
        ) : (
          <p className="px-1 py-8 text-center text-xs text-muted-foreground">{meta.emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

interface ContentLibraryColumnsProps {
  grouped: Record<LibraryColumnId, KBAsset[]>;
  onSelectAsset: (asset: KBAsset) => void;
}

export function ContentLibraryColumns({ grouped, onSelectAsset }: ContentLibraryColumnsProps) {
  return (
    <div className="grid h-[min(680px,calc(100vh-15rem))] min-h-[420px] grid-cols-1 gap-4 lg:grid-cols-3">
      {(Object.keys(LIBRARY_COLUMN_META) as LibraryColumnId[]).map((columnId) => (
        <ContentLibraryColumn
          key={columnId}
          columnId={columnId}
          assets={grouped[columnId]}
          onSelectAsset={onSelectAsset}
          className="h-full"
        />
      ))}
    </div>
  );
}
