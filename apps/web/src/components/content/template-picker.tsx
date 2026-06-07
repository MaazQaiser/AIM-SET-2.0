"use client";

import { useState } from "react";
import { AlertCircle, Check, LayoutTemplate, Paperclip, X } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Label } from "@dc-copilot/ui/components/label";
import { cn } from "@/lib/cn";
import type { ContentTemplate } from "@/types/content_studio";

export function TemplatePicker({
  templates,
  recommendedIds,
  selectedId,
  onSelect,
  isLoading = false,
  showRequired = false,
}: {
  templates: ContentTemplate[];
  recommendedIds?: string[];
  selectedId?: string;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  showRequired?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selected = templates.find((t) => t.id === selectedId);
  const isMissing = showRequired && !selectedId;

  const sorted = [...templates].sort((a, b) => {
    const ar = recommendedIds?.includes(a.id) ? 0 : 1;
    const br = recommendedIds?.includes(b.id) ? 0 : 1;
    return ar - br;
  });

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label
        className={cn(
          "flex items-center gap-1 text-xs",
          isMissing ? "text-destructive" : "text-muted-foreground"
        )}
      >
        Template
        <span className="text-destructive" aria-hidden="true">*</span>
        {isMissing && (
          <span className="flex items-center gap-0.5 font-medium">
            <AlertCircle className="h-3 w-3" />
            Required before generating
          </span>
        )}
      </Label>

      {/* Selected template pill + attach / change button */}
      <div className="flex items-center gap-2">
        {selected ? (
          <div
            className={cn(
              "flex flex-1 min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
              "border-primary/30 bg-primary/5"
            )}
          >
            {selected.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.thumbnailUrl}
                alt=""
                className="h-6 w-9 shrink-0 rounded object-cover"
              />
            ) : (
              <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 truncate font-medium">{selected.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {selected.pageCount} slides
            </span>
            <button
              type="button"
              aria-label="Remove template"
              className="ml-auto shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
              onClick={() => onSelect("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground",
              isMissing ? "border-destructive/60 bg-destructive/5" : "border-dashed border-border"
            )}
          >
            <LayoutTemplate className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {isLoading ? "Loading templates…" : "No template selected"}
            </span>
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={() => setOpen(true)}
          className="shrink-0"
        >
          <Paperclip className="h-3.5 w-3.5 mr-1" />
          {selected ? "Change" : "Attach"}
        </Button>
      </div>

      {/* Template picker modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-base">Select a template</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <LayoutTemplate className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No templates available</p>
                <p className="text-xs text-muted-foreground">
                  Go to the Templates tab to upload or create a template first.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sorted.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isSelected={t.id === selectedId}
                    isRecommended={recommendedIds?.includes(t.id) ?? false}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  isRecommended,
  onSelect,
}: {
  template: ContentTemplate;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      disabled={template.status !== "ready"}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
        "hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card",
        template.status !== "ready" && "cursor-not-allowed opacity-60"
      )}
    >
      {/* Thumbnail or placeholder */}
      <div className="w-full overflow-hidden rounded-md bg-muted aspect-video flex items-center justify-center">
        {template.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{template.name}</p>
          <p className="text-xs text-muted-foreground">
            {template.pageCount} slides
            {template.sourceFileName ? ` · ${template.sourceFileName}` : ""}
          </p>
        </div>
        {isSelected && (
          <span className="shrink-0 rounded-full bg-primary p-0.5 text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {isRecommended && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            ★ Recommended
          </Badge>
        )}
        <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
          {template.artifactType.replace(/_/g, " ")}
        </Badge>
        {template.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  );
}
