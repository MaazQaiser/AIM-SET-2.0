"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@dc-copilot/ui/components/badge";
import type { ContentTemplate } from "@/types/content_studio";

export function TemplatePicker({
  templates,
  recommendedIds,
  selectedId,
  onSelect,
}: {
  templates: ContentTemplate[];
  recommendedIds?: string[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const sorted = [...templates].sort((a, b) => {
    const ar = recommendedIds?.includes(a.id) ? 0 : 1;
    const br = recommendedIds?.includes(b.id) ? 0 : 1;
    return ar - br;
  });

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No templates yet. Upload a PPT, PDF, or image under Templates.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto">
      {sorted.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={cn(
            "w-full text-left rounded-md border p-3 transition-colors hover:bg-muted/50",
            selectedId === t.id && "border-primary bg-primary/5"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium">{t.name}</span>
            {selectedId === t.id && <Check className="h-4 w-4 text-primary shrink-0" />}
          </div>
          <div className="flex gap-1 mt-1 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {t.artifactType}
            </Badge>
            {recommendedIds?.includes(t.id) && (
              <Badge variant="secondary" className="text-[10px]">
                Recommended
              </Badge>
            )}
            {t.status !== "ready" && (
              <Badge variant="warning" className="text-[10px]">
                {t.status}
              </Badge>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
