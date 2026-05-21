"use client";

import { AlertCircle } from "lucide-react";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface PostDiscoveryGapsCardProps {
  gaps: string[];
  bantCoverage?: number;
}

export function PostDiscoveryGapsCard({ gaps, bantCoverage }: PostDiscoveryGapsCardProps) {
  const { compact } = useWidgetSize();

  if (gaps.length === 0 && bantCoverage === undefined) return null;

  return (
    <Card className="h-full border-amber-500/20">
      <CardHeader className={cn("pb-2", compact && "pb-1.5")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          Discovery gaps
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {bantCoverage !== undefined && (
          <p className="text-xs text-muted-foreground">
            Live BANT coverage at call end: {Math.round(bantCoverage * 100)}%
          </p>
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
          <p className="text-xs text-muted-foreground">All core discovery items were covered.</p>
        )}
      </CardContent>
    </Card>
  );
}
