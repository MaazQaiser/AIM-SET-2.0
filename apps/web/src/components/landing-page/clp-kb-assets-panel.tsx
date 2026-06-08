"use client";

import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import { useKbAssets } from "@/lib/data/hooks";
import {
  isCompanyPlaybookLandingAsset,
  syncAssetSections,
  toggleSelectedAsset,
} from "@/lib/landing-page/clp-editor-utils";
import type { ClpAssetRef, CustomerLandingPage } from "@dc-copilot/types";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Check, Search, Sparkles, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

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
  const selectedAssetIds = useMemo(
    () => new Set(safeDraft.selectedAssets.map((asset) => asset.assetId)),
    [safeDraft.selectedAssets]
  );

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

  function toggle(asset: Pick<ClpAssetRef, "assetId" | "title"> & Partial<ClpAssetRef>) {
    onChange(toggleSelectedAsset(draft, asset));
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
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="type-caption text-muted-foreground">{description}</p>
          <div className="flex flex-wrap items-center gap-2">
            {safeDraft.selectedAssets.length > 0 ? (
              safeDraft.selectedAssets.map((asset) => (
                <button
                  key={asset.assetId}
                  type="button"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-success/20 bg-success px-3 py-1.5 text-left text-success-foreground shadow-soft-xs transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => toggle(asset)}
                  aria-label={`Remove ${asset.title} from the landing page`}
                  title="Remove from page"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate type-caption font-medium">{asset.title}</span>
                  <X className="h-3 w-3 shrink-0 opacity-80" />
                </button>
              ))
            ) : (
              <span className="type-caption text-muted-foreground">
                No extra decks or documents selected yet.
              </span>
            )}
          </div>
        </div>

        {safeDraft.aiSuggestions.length > 0 && (
          <section className="space-y-2 border-t border-border/50 pt-4">
            <SectionHeader
              eyebrow="Recommended"
              title="AI suggestions"
              detail="Based on this discovery call"
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />
            <ul className="space-y-1.5">
              {safeDraft.aiSuggestions.map((asset) => {
                const selected = selectedAssetIds.has(asset.assetId);
                return (
                  <li
                    key={asset.assetId}
                    className="flex items-center justify-between gap-3 border-b border-border/35 py-2 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate type-label",
                        selected ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {asset.title}
                    </span>
                    <AssetToggleButton
                      selected={selected}
                      onClick={() => toggle({ assetId: asset.assetId, title: asset.title })}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="space-y-3 border-t border-border/50 pt-4">
          <SectionHeader
            eyebrow="Knowledge base"
            title="Browse decks & documents"
            detail={`${readyAssets.length} matching asset${readyAssets.length === 1 ? "" : "s"}`}
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search KB…"
              className="h-9 rounded-full pl-8 type-body"
            />
          </div>

          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {isLoading ? (
              <li className="type-caption text-muted-foreground py-2">Loading assets…</li>
            ) : readyAssets.length === 0 ? (
              <li className="type-caption text-muted-foreground py-2">No matching assets.</li>
            ) : (
              readyAssets.slice(0, 40).map((asset) => {
                const selected = selectedAssetIds.has(asset.id);
                return (
                  <li
                    key={asset.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      selected
                        ? "border-success/25 bg-success/5"
                        : "border-border/65 hover:bg-muted/30"
                    )}
                  >
                    <KbFileTypeIcon fileName={asset.fileName} mimeType={asset.mimeType} size="sm" />
                    <span className="min-w-0 flex-1 truncate type-label font-medium">
                      {asset.title}
                    </span>
                    <AssetToggleButton
                      selected={selected}
                      onClick={() =>
                        toggle({
                          assetId: asset.id,
                          title: asset.title,
                          fileName: asset.fileName,
                          mimeType: asset.mimeType,
                          hasPreview: asset.hasPreview,
                          previewSlideCount: asset.previewSlideCount,
                        })
                      }
                    />
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </BriefDetailCard>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
  icon,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="type-kicker whitespace-nowrap text-muted-foreground">{eyebrow}</p>
        <div className="flex min-w-0 items-center gap-1.5">
          {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
          <p className="truncate type-label font-semibold text-foreground">{title}</p>
        </div>
      </div>
      {detail ? <p className="type-caption text-muted-foreground sm:shrink-0">{detail}</p> : null}
    </div>
  );
}

function AssetToggleButton({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "h-7 shrink-0 rounded-full px-3 type-caption",
        selected &&
          "border-success/20 bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground"
      )}
      onClick={onClick}
      aria-label={selected ? "Remove asset from landing page" : "Add asset to landing page"}
    >
      {selected ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Added
        </>
      ) : (
        "Add"
      )}
    </Button>
  );
}
