"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { Calendar, Database, Layers, Tag, TrendingUp, Users } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { KbFileFormatBadge } from "@/components/knowledge/kb-file-format-badge";
import type { KBAsset } from "@/types";
import { cn } from "@/lib/cn";

function StatRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 type-body">
      <span className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatAssetType(type: string) {
  return type.replace(/-/g, " ");
}

interface KbAssetStatisticsProps {
  asset: KBAsset;
  suggestedLeadCount?: number;
  suggestedLeadCountLoading?: boolean;
  className?: string;
}

export function KbAssetStatistics({
  asset,
  suggestedLeadCount,
  suggestedLeadCountLoading = false,
  className,
}: KbAssetStatisticsProps) {
  const status = asset.status ?? "ready";
  const leadCount = suggestedLeadCount ?? 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="type-kicker text-muted-foreground">Statistics</p>
        <div className="mt-4 space-y-3">
          <StatRow
            label="Format"
            value={<KbFileFormatBadge fileName={asset.fileName} mimeType={asset.mimeType} />}
          />
          <StatRow label="Type" value={<span className="capitalize">{formatAssetType(asset.type)}</span>} icon={Layers} />
          <StatRow label="Version" value={`v${asset.version}`} />
          <StatRow
            label="Status"
            value={
              <Badge variant={status === "ready" ? "success" : status === "failed" ? "destructive" : "secondary"} className="capitalize type-caption">
                {status}
              </Badge>
            }
          />
          {asset.previewSlideCount !== undefined && asset.previewSlideCount > 0 ? (
            <StatRow label="Slides" value={asset.previewSlideCount} />
          ) : null}
          {asset.chunkCount !== undefined ? (
            <StatRow label="Indexed chunks" value={asset.chunkCount} icon={Database} />
          ) : null}
          {asset.effectivenessScore !== undefined ? (
            <StatRow
              label="Effectiveness"
              value={`${Math.round(asset.effectivenessScore * 100)}%`}
              icon={TrendingUp}
            />
          ) : null}
          <StatRow
            label="Suggested in"
            value={
              suggestedLeadCountLoading
                ? "..."
                : `${leadCount} ${leadCount === 1 ? "lead" : "leads"}`
            }
            icon={Users}
          />
          {asset.uploadedAt ? (
            <StatRow
              label="Uploaded"
              value={format(new Date(asset.uploadedAt), "MMM d, yyyy")}
              icon={Calendar}
            />
          ) : null}
          {asset.lastUsed ? (
            <StatRow
              label="Last used"
              value={format(new Date(asset.lastUsed), "MMM d, yyyy")}
              icon={Calendar}
            />
          ) : null}
        </div>
      </div>

      {asset.tags.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 type-kicker text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {asset.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="type-caption">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {asset.fileName ? (
        <p className="type-caption text-muted-foreground break-all">{asset.fileName}</p>
      ) : null}
    </div>
  );
}
