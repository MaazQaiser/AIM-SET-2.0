"use client";

import { AlertCircle } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { BriefDetailCard, BriefDetailRow } from "@/components/pre-call/brief-detail-card";

interface PostDiscoveryGapsCardProps {
  gaps: string[];
  bantCoverage?: number;
}

export function PostDiscoveryGapsCard({ gaps, bantCoverage }: PostDiscoveryGapsCardProps) {
  if (gaps.length === 0 && bantCoverage === undefined) return null;

  return (
    <BriefDetailCard title="Discovery gaps" icon={AlertCircle} variant="warning">
      {bantCoverage !== undefined && (
        <BriefDetailRow className="mb-2">
          <p className="text-sm text-foreground">
            BANT coverage at call end:{" "}
            <span className="font-semibold">{Math.round(bantCoverage * 100)}%</span>
          </p>
        </BriefDetailRow>
      )}
      {gaps.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {gaps.map((gap) => (
            <li key={gap}>
              <Badge variant="outline" className="text-xs capitalize">
                {gap.replace(/_/g, " ")}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">All core discovery items were covered.</p>
      )}
    </BriefDetailCard>
  );
}
