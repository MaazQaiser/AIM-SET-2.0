"use client";

import { FileText, Presentation, Layout, Map, Shield, TrendingUp, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/chip";
import { Card, CardContent } from "@/components/ui/card";
import type { KBAsset } from "@/types";

const typeConfig: Record<string, { icon: typeof FileText; label: string }> = {
  deck: { icon: Presentation, label: "Deck" },
  "case-study": { icon: FileText, label: "Case Study" },
  image: { icon: ImageIcon, label: "Image" },
  "one-pager": { icon: Layout, label: "OnePager" },
  architecture: { icon: Map, label: "Architecture Diagram" },
  battlecard: { icon: Shield, label: "Battle Card" },
};

function EffectivenessBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${score * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
    </div>
  );
}

interface KBAssetCardProps {
  asset: KBAsset;
  onSelect?: (asset: KBAsset) => void;
}

export function KBAssetCard({ asset, onSelect }: KBAssetCardProps) {
  const config = typeConfig[asset.type] ?? { icon: FileText, label: asset.type };
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        "hover:shadow-soft-sm transition-shadow",
        onSelect && "cursor-pointer hover:border-primary/50"
      )}
      onClick={() => onSelect?.(asset)}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(asset);
        }
      }}
      role={onSelect ? "button" : undefined}
      aria-label={onSelect ? `Select ${asset.title}` : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{asset.title}</p>
            <p className="text-xs text-muted-foreground">
              {config.label} · v{asset.version}
              {asset.status && asset.status !== "ready" && (
                <span className="ml-1 capitalize">· {asset.status}</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {asset.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} variant="tag">
              {tag}
            </Chip>
          ))}
          {asset.tags.length > 3 && (
            <Chip variant="muted">+{asset.tags.length - 3}</Chip>
          )}
        </div>

        {asset.effectivenessScore !== undefined && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Effectiveness
            </div>
            <EffectivenessBar score={asset.effectivenessScore} />
          </div>
        )}

        {asset.lastUsed && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last used {format(new Date(asset.lastUsed), "MMM d")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
