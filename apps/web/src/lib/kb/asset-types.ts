import type { AssetType } from "@/types";

export const KB_ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "deck", label: "Deck" },
  { value: "case-study", label: "Case Study" },
  { value: "one-pager", label: "One-Pager" },
  { value: "architecture", label: "Architecture" },
  { value: "battlecard", label: "Battlecard" },
];

const EXTENSION_ASSET_TYPE: Record<string, AssetType> = {
  ".pdf": "deck",
  ".pptx": "deck",
  ".ppt": "deck",
  ".docx": "one-pager",
  ".csv": "case-study",
  ".png": "one-pager",
  ".jpg": "one-pager",
  ".jpeg": "one-pager",
};

export function defaultAssetTypeForFile(fileName: string): AssetType {
  const ext = fileName.includes(".") ? `.${fileName.split(".").pop()!.toLowerCase()}` : "";
  return EXTENSION_ASSET_TYPE[ext] ?? "deck";
}
