"use client";

import { useState } from "react";
import { CalendarDays, Check, Eye, Files, LayoutTemplate } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { TemplateDetailDialog } from "@/components/content/template-detail-dialog";
import { cn } from "@/lib/cn";
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
  const [exploreTemplateId, setExploreTemplateId] = useState<string | null>(null);
  const sorted = [...templates].sort((a, b) => {
    const ar = recommendedIds?.includes(a.id) ? 0 : 1;
    const br = recommendedIds?.includes(b.id) ? 0 : 1;
    return ar - br;
  });
  const selectedTemplate = sorted.find((template) => template.id === selectedId);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No templates yet. Upload or create templates under Knowledge Base → Templates.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {sorted.map((t) => {
            const isRecommended = recommendedIds?.includes(t.id);
            const isSelected = selectedId === t.id;

            return (
              <div
                key={t.id}
                className={cn(
                  "flex items-stretch rounded-md border transition-colors hover:bg-muted/50",
                  isSelected && "border-primary bg-primary/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="min-w-0 flex-1 p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="break-words text-sm font-medium">{t.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {t.artifactType}
                    </Badge>
                    {isRecommended && (
                      <Badge variant="secondary" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                    <Badge
                      variant={t.status === "ready" ? "success" : "warning"}
                      className="text-[10px]"
                    >
                      {t.status}
                    </Badge>
                  </div>
                </button>
                <div className="flex items-center border-l px-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setExploreTemplateId(t.id)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Explore {t.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Explore template</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>

        {selectedTemplate && <SelectedTemplateSummary template={selectedTemplate} />}
      </div>

      <TemplateDetailDialog
        templateId={exploreTemplateId}
        open={Boolean(exploreTemplateId)}
        onOpenChange={(open) => !open && setExploreTemplateId(null)}
        onUseTemplate={onSelect}
        selectedTemplateId={selectedId}
      />
    </>
  );
}

function SelectedTemplateSummary({ template }: { template: ContentTemplate }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <LayoutTemplate className="h-3.5 w-3.5" />
        Active template
      </div>
      <p className="break-words text-sm font-medium">{template.name}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Files className="h-3.5 w-3.5" />
          {template.pageCount} pages
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(template.createdAt)}
        </span>
      </div>
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 4 && (
            <Badge variant="outline" className="text-[10px]">
              +{template.tags.length - 4}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}
