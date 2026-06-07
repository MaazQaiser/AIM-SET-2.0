import type { AssetType } from "@/types";

export const KB_ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "deck", label: "Deck" },
  { value: "image", label: "Image" },
  { value: "architecture", label: "Architecture Diagram" },
  { value: "battlecard", label: "Battle Card" },
  { value: "one-pager", label: "OnePager" },
];

const EXTENSION_ASSET_TYPE: Record<string, AssetType> = {
  ".pdf": "deck",
  ".pptx": "deck",
  ".ppt": "deck",
  ".docx": "one-pager",
  ".csv": "one-pager",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
};

export function defaultAssetTypeForFile(fileName: string): AssetType {
  const ext = fileName.includes(".") ? `.${(fileName.split(".").pop() ?? "").toLowerCase()}` : "";
  return EXTENSION_ASSET_TYPE[ext] ?? "deck";
}
