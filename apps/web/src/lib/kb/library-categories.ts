import type { KBAsset } from "@/types";

export type LibraryColumnId = "slide-decks" | "case-studies" | "others";

export function categorizeLibraryAsset(asset: KBAsset): LibraryColumnId {
  if (asset.type === "deck") return "slide-decks";
  if (asset.type === "case-study") return "case-studies";
  return "others";
}

export function groupAssetsByLibraryColumn(assets: KBAsset[]): Record<LibraryColumnId, KBAsset[]> {
  const groups: Record<LibraryColumnId, KBAsset[]> = {
    "slide-decks": [],
    "case-studies": [],
    others: [],
  };

  for (const asset of assets) {
    groups[categorizeLibraryAsset(asset)].push(asset);
  }

  for (const key of Object.keys(groups) as LibraryColumnId[]) {
    groups[key].sort((a, b) => a.title.localeCompare(b.title));
  }

  return groups;
}
