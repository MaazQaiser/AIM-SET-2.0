"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { useKbAssets } from "@/lib/data/hooks";
import type { CustomerLandingPage } from "@dc-copilot/types";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import {
  isCompanyPlaybookLandingAsset,
  syncAssetSections,
  toggleSelectedAsset,
} from "@/lib/landing-page/clp-editor-utils";

interface ClpKbAssetsPanelProps {
  draft: CustomerLandingPage;
  onChange: (page: CustomerLandingPage) => void;
  heading?: string;
  description?: string;
}

export function ClpKbAssetsPanel({
  draft,
  onChange,
  heading = "Knowledge base assets",
  description = "Add or upload assets to show on the landing page. Selected assets appear in the Shared resources section.",
}: ClpKbAssetsPanelProps) {
  const { data: assets = [], isLoading } = useKbAssets();
  const [query, setQuery] = useState("");
  const safeDraft = useMemo(() => syncAssetSections(draft), [draft]);

  const readyAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (a.status ?? "ready") === "ready" &&
          !isCompanyPlaybookLandingAsset(a) &&
          a.title.toLowerCase().includes(query.toLowerCase())
      ),
    [assets, query]
  );

  function toggle(assetId: string, title: string) {
    onChange(toggleSelectedAsset(draft, { assetId, title }));
  }

  return (
    <BriefDetailCard
      title={heading}
      headerExtra={
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
      }
    >
      <div className="space-y-3">
        <p className="type-caption text-muted-foreground">{description}</p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search KB…"
            className="h-8 pl-8 type-body"
          />
        </div>

        {safeDraft.selectedAssets.length > 0 && (
          <div className="space-y-1">
            <p className="type-caption font-medium text-muted-foreground">
              On page ({safeDraft.selectedAssets.length})
            </p>
            <ul className="space-y-1">
              {safeDraft.selectedAssets.map((a) => (
                <li
                  key={a.assetId}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 type-label"
                >
                  <span className="truncate font-medium">{a.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-2 type-caption"
                    onClick={() => toggle(a.assetId, a.title)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {safeDraft.aiSuggestions.length > 0 && (
          <div className="space-y-1">
            <p className="type-caption font-medium text-muted-foreground">AI suggestions</p>
            <ul className="space-y-1">
              {safeDraft.aiSuggestions.map((a) => {
                const selected = safeDraft.selectedAssets.some((s) => s.assetId === a.assetId);
                return (
                  <li key={a.assetId} className="flex items-center justify-between gap-2 type-label">
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
            <li className="type-caption text-muted-foreground py-2">Loading assets…</li>
          ) : readyAssets.length === 0 ? (
            <li className="type-caption text-muted-foreground py-2">No matching assets.</li>
          ) : (
            readyAssets.slice(0, 40).map((asset) => {
              const selected = safeDraft.selectedAssets.some((s) => s.assetId === asset.id);
              return (
                <li
                  key={asset.id}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 hover:bg-muted/30"
                >
                  <KbFileTypeIcon fileName={asset.fileName} mimeType={asset.mimeType} size="sm" />
                  <span className="min-w-0 flex-1 truncate type-label">{asset.title}</span>
                  <Button
                    variant={selected ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 shrink-0 type-caption"
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
    </BriefDetailCard>
  );
}
