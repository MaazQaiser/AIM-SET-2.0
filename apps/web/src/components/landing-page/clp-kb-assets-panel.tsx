"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { useKbAssets } from "@/lib/data/hooks";
import type { CustomerLandingPage } from "@dc-copilot/types";
import { toggleSelectedAsset } from "@/lib/landing-page/clp-editor-utils";

interface ClpKbAssetsPanelProps {
  draft: CustomerLandingPage;
  onChange: (page: CustomerLandingPage) => void;
}

export function ClpKbAssetsPanel({ draft, onChange }: ClpKbAssetsPanelProps) {
  const { data: assets = [], isLoading } = useKbAssets();
  const [query, setQuery] = useState("");

  const readyAssets = useMemo(
    () =>
      assets.filter((a) => (a.status ?? "ready") === "ready" && a.title.toLowerCase().includes(query.toLowerCase())),
    [assets, query]
  );

  function toggle(assetId: string, title: string) {
    onChange(toggleSelectedAsset(draft, { assetId, title }));
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Knowledge base assets</h2>
        <KbUploadButton
          onAssetReady={(asset) => {
            onChange(
              toggleSelectedAsset(draft, {
                assetId: asset.id,
                title: asset.title,
              })
            );
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Add or upload assets to show on the landing page. Selected assets appear in the Shared
        resources section.
      </p>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search KB…"
          className="h-8 pl-8 text-sm"
        />
      </div>

      {draft.selectedAssets.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">
            On page ({draft.selectedAssets.length})
          </p>
          <ul className="space-y-1">
            {draft.selectedAssets.map((a) => (
              <li
                key={a.assetId}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
              >
                <span className="truncate font-medium">{a.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[10px]"
                  onClick={() => toggle(a.assetId, a.title)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.aiSuggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">
            AI suggestions
          </p>
          <ul className="space-y-1">
            {draft.aiSuggestions.map((a) => {
              const selected = draft.selectedAssets.some((s) => s.assetId === a.assetId);
              return (
                <li key={a.assetId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{a.title}</span>
                  <Button
                    variant={selected ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 shrink-0"
                    onClick={() => toggle(a.assetId, a.title)}
                  >
                    {selected ? "Added" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {isLoading ? (
          <li className="text-xs text-muted-foreground py-2">Loading assets…</li>
        ) : readyAssets.length === 0 ? (
          <li className="text-xs text-muted-foreground py-2">No matching assets.</li>
        ) : (
          readyAssets.slice(0, 40).map((asset) => {
            const selected = draft.selectedAssets.some((s) => s.assetId === asset.id);
            return (
              <li
                key={asset.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 hover:bg-muted/30"
              >
                <KbFileTypeIcon fileName={asset.fileName} mimeType={asset.mimeType} size="sm" />
                <span className="min-w-0 flex-1 truncate text-xs">{asset.title}</span>
                <Button
                  variant={selected ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 shrink-0 text-[10px]"
                  onClick={() => toggle(asset.id, asset.title)}
                >
                  {selected ? "Added" : "Add"}
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
