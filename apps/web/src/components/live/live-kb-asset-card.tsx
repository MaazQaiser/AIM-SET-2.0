"use client";

import Link from "next/link";
import { ExternalLink, FileText, Presentation, Layout, Map as MapIcon, Shield, Image as ImageIcon } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Chip } from "@dc-copilot/ui/components/chip";
import { cn } from "@/lib/cn";
import type { KBAsset } from "@/types";

const typeConfig: Record<string, { icon: typeof FileText; label: string }> = {
  deck: { icon: Presentation, label: "Deck" },
  "case-study": { icon: FileText, label: "Knowledge Asset" },
  image: { icon: ImageIcon, label: "Image" },
  "one-pager": { icon: Layout, label: "OnePager" },
  architecture: { icon: MapIcon, label: "Architecture" },
  battlecard: { icon: Shield, label: "Battle Card" },
};

interface LiveKbAssetCardProps {
  asset: KBAsset;
  className?: string;
}

export function LiveKbAssetCard({ asset, className }: LiveKbAssetCardProps) {
  const config = typeConfig[asset.type] ?? { icon: FileText, label: asset.type };
  const Icon = config.icon;
  const href = `/knowledge/${asset.id}`;

  return (
    <div
      className={cn(
        "glass-insight-card overflow-hidden shadow-none",
        className
      )}
    >
      <div className="flex items-start gap-2.5 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-accent-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="type-body font-medium text-foreground truncate">{asset.title}</p>
          <p className="type-caption text-muted-foreground">{config.label}</p>
        </div>
      </div>
      {asset.tags.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {asset.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} variant="tag" className="type-caption">
              {tag}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 border-t border-border/60 p-2 bg-muted/20">
        <Button asChild variant="secondary" size="sm" className="h-7 flex-1 type-label">
          <Link href={href}>Open</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-7 flex-1 type-label">
          <Link href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1" aria-hidden />
            New tab
          </Link>
        </Button>
      </div>
    </div>
  );
}
