"use client";

import { FilePlus2, FolderKanban } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import {
  BriefDetailCard,
  briefMainBody,
  briefMainLead,
  briefMainMuted,
  briefMainUnderline,
} from "@/components/pre-call/brief-detail-card";
import type { ContentToGenerate } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface BriefContentToGeneratePanelProps {
  items?: ContentToGenerate[];
}

function isSmartDeckSuggestion(item: ContentToGenerate) {
  const text = `${item.name} ${item.reason} ${item.neededFor}`.toLowerCase();
  if (item.type !== "deck") return false;
  if (text.includes("one-pager") || text.includes("one pager") || text.includes("one_pager")) {
    return false;
  }
  if (text.includes("tk overview deck") || text.includes("tkxel overview deck")) return false;
  if (text.includes("service one-pager") || text.includes("service one pager")) return false;
  return true;
}

function projectSummary(item: ContentToGenerate) {
  const projects = item.relevantProjects ?? [];
  if (projects.length === 0) return "Add relevant projects from the projects library.";
  const names = projects.slice(0, 3).map((project) => project.title).filter(Boolean);
  const suffix = projects.length > names.length ? ` +${projects.length - names.length} more` : "";
  return `Add project proof: ${names.join("; ")}${suffix}.`;
}

export function BriefContentToGeneratePanel({ items }: BriefContentToGeneratePanelProps) {
  const gaps = (items ?? [])
    .filter(isSmartDeckSuggestion)
    .slice()
    .sort((a, b) => a.priority - b.priority);
  if (gaps.length === 0) return null;

  return (
    <BriefDetailCard
      tone="main"
      title="Content to Generate for similar Leads"
      icon={FilePlus2}
      variant="warning"
      sourceInfo={{
        source: "AI gap check against KB and projects library",
        detail:
          "Only industry-vertical deck suggestions appear here. Generic company overview decks and one-pagers are intentionally excluded because the approved company deck already exists.",
      }}
      headerExtra={
        <span className="type-caption text-muted-foreground shrink-0">
          {gaps.length} suggestion{gaps.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="space-y-2">
        <ul className="divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden">
          {gaps.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <FilePlus2 className="mt-1 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className={cn(briefMainLead, briefMainUnderline, "min-w-0 flex-1 break-words")}>
                      {item.name}
                    </p>
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-950 type-caption"
                    >
                      Deck suggestion
                    </Badge>
                  </div>
                  <p className={cn(briefMainBody, "mt-1 line-clamp-2")}>{item.reason}</p>
                  <p className={cn(briefMainMuted, "mt-1 flex items-center gap-1.5")}>
                    <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">{projectSummary(item)}</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </BriefDetailCard>
  );
}
