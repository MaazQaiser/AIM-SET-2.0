"use client";

import { ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Citation } from "@/types";

interface CitationMarkerProps {
  index: number;
  citation: Citation;
}

const typeLabels: Record<string, string> = {
  deck: "Sales Deck",
  "case-study": "Case Study",
  "one-pager": "One-Pager",
  architecture: "Reference Architecture",
  battlecard: "Battlecard",
  transcript: "Call Transcript",
};

export function CitationMarker({ index, citation }: CitationMarkerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors align-super ml-0.5"
          aria-label={`Citation ${index}: ${citation.title}`}
        >
          {index}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{citation.title}</p>
              <p className="text-xs text-muted-foreground">{typeLabels[citation.type] ?? citation.type}</p>
            </div>
            {citation.url && (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-primary hover:underline"
                aria-label="Open source"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {citation.excerpt && (
            <blockquote className="border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground italic">
              {citation.excerpt}
            </blockquote>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
