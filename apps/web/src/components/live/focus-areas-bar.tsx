"use client";

import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FocusAreasBarProps {
  areas: string[];
  intentLabel?: string;
}

export function FocusAreasBar({ areas, intentLabel }: FocusAreasBarProps) {
  if (areas.length === 0 && !intentLabel) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
      <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Focus
      </span>
      {intentLabel && (
        <Badge variant="secondary" className="text-[10px] font-normal">
          {intentLabel.replace(/_/g, " ")}
        </Badge>
      )}
      {areas.map((area) => (
        <Badge key={area} variant="outline" className="text-[10px] font-normal">
          {area}
        </Badge>
      ))}
    </div>
  );
}
