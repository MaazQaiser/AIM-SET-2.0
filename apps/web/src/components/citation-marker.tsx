"use client";

import { ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@dc-copilot/ui/components/popover";
import type { Citation } from "@/types";

interface CitationMarkerProps {
  index: number;
  citation: Citation;
}

interface CitationSourceListProps {
  citations: Citation[];
  className?: string;
}

const sourceLabels: Record<string, string> = {
  transcript: "Live transcript",
  kb_document: "Company knowledge base",
  knowledge_base: "Company knowledge base",
  deck: "Company knowledge base",
  "case-study": "Company knowledge base",
  image: "Company knowledge base",
  "one-pager": "Company knowledge base",
  architecture: "Company knowledge base",
  battlecard: "Company knowledge base",
  call_record: "Call data",
  call_brief: "Pre-call brief",
  post_call_review: "Post-call review",
  ui_context: "Current screen",
  system: "Copilot context",
};

const sourceDescriptions: Record<string, string> = {
  transcript: "Pulled from this live call transcript.",
  kb_document: "Pulled from your approved company knowledge base.",
  knowledge_base: "Pulled from your approved company knowledge base.",
  deck: "Pulled from your approved company knowledge base.",
  "case-study": "Pulled from your approved company knowledge base.",
  image: "Pulled from your approved company knowledge base.",
  "one-pager": "Pulled from your approved company knowledge base.",
  architecture: "Pulled from your approved company knowledge base.",
  battlecard: "Pulled from your approved company knowledge base.",
  call_record: "Pulled from saved call data.",
  call_brief: "Pulled from the pre-call brief.",
  post_call_review: "Pulled from the post-call review.",
  ui_context: "Pulled from the current screen and live call state.",
  system: "Pulled from Copilot's available context.",
};

function sourceKey(citation: Citation) {
  const type = String(citation.type || "").toLowerCase();
  const title = String(citation.title || "").toLowerCase();
  if (type in sourceLabels) return type;
  if (title.includes("knowledge") || title.includes("kb")) return "kb_document";
  if (title.includes("transcript")) return "transcript";
  if (title.includes("brief")) return "call_brief";
  if (title.includes("review")) return "post_call_review";
  if (title.includes("screen") || title.includes("context")) return "ui_context";
  return "system";
}

export function citationSourceLabel(citation: Citation) {
  return sourceLabels[sourceKey(citation)] ?? "Source";
}

export function missingEvidenceLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("pre-dc") || normalized.includes("brief")) return "Pre-call brief";
  if (normalized.includes("transcript")) return "Live transcript";
  if (normalized.includes("knowledge")) return "Company knowledge base";
  if (normalized.includes("post")) return "Post-call review";
  if (normalized.includes("call record")) return "Call data";
  return value;
}

export function CitationMarker({ index, citation }: CitationMarkerProps) {
  const key = sourceKey(citation);
  const label = citationSourceLabel(citation);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-5 cursor-pointer items-center justify-center rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 type-caption font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Source ${index}: ${label}`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="type-kicker text-muted-foreground">
                Source
              </p>
              <p className="type-body font-medium text-foreground">{label}</p>
              <p className="type-caption text-muted-foreground">{sourceDescriptions[key]}</p>
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
            <div className="space-y-1">
              <p className="type-kicker text-muted-foreground">
                Evidence excerpt
              </p>
              <blockquote className="border-l-2 border-primary/30 pl-3 type-caption text-muted-foreground">
                {citation.excerpt}
              </blockquote>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CitationSourceList({ citations, className }: CitationSourceListProps) {
  if (!citations.length) return null;
  const sourceNames = Array.from(new Set(citations.map(citationSourceLabel)));
  if (!sourceNames.length) return null;

  return (
    <p className={`type-caption leading-relaxed text-muted-foreground ${className ?? ""}`}>
      <span className="type-kicker">Sources:</span>{" "}
      {sourceNames.join(", ")}
    </p>
  );
}
