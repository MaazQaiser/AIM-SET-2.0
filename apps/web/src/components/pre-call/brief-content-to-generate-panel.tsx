"use client";

import { AlertTriangle, FilePlus2 } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { BriefDetailCard, BriefDetailRow } from "@/components/pre-call/brief-detail-card";
import type { ContentToGenerate } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface BriefContentToGeneratePanelProps {
  items?: ContentToGenerate[];
}

const STATUS_LABEL: Record<ContentToGenerate["status"], string> = {
  missing: "Missing",
  partial: "Partial",
};

export function BriefContentToGeneratePanel({ items }: BriefContentToGeneratePanelProps) {
  const gaps = (items ?? []).slice().sort((a, b) => a.priority - b.priority);
  if (gaps.length === 0) return null;

  return (
    <BriefDetailCard
      title="Content to generate"
      icon={FilePlus2}
      variant="warning"
      sourceInfo={{
        source: "AI gap check against KB",
        detail:
          "If the workflow planned an asset but KB has no strong match, it lists that content here and explains why creating it would improve call prep.",
      }}
      headerExtra={
        <span className="text-xs text-muted-foreground shrink-0">
          {gaps.length} gap{gaps.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          These assets are not strong enough in the knowledge base yet. Creating them would make the
          call prep sharper.
        </p>
        <ul className="space-y-2">
          {gaps.map((item) => (
            <li key={item.id}>
              <BriefDetailRow className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      "h-3.5 w-3.5",
                      item.status === "missing" ? "text-rose-700" : "text-amber-700"
                    )}
                  />
                  <p className="min-w-0 flex-1 text-sm font-medium break-words">{item.name}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      item.status === "missing"
                        ? "border-rose-200 bg-rose-50 text-rose-950"
                        : "border-amber-200 bg-amber-50 text-amber-950"
                    )}
                  >
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Why generate it: </span>
                  {item.reason}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Needed for: </span>
                  {item.neededFor}
                </p>
              </BriefDetailRow>
            </li>
          ))}
        </ul>
      </div>
    </BriefDetailCard>
  );
}
