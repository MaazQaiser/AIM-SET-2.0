"use client";

import { Database, FileText, Library } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Badge } from "@dc-copilot/ui/components/badge";
import type { RelevantProject, RelevantProjectSource } from "@/lib/brief-types";

const SOURCE_LABEL: Record<RelevantProjectSource, string> = {
  knowledge_base: "Knowledge base",
  project_database: "Project database",
  dc_notes: "DC notes",
};

function SourceIcon({ source }: { source: RelevantProjectSource }) {
  if (source === "project_database") return <Database className="h-3.5 w-3.5" />;
  if (source === "dc_notes") return <FileText className="h-3.5 w-3.5" />;
  return <Library className="h-3.5 w-3.5" />;
}

interface RelevantProjectDetailDialogProps {
  project: RelevantProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RelevantProjectDetailDialog({
  project,
  open,
  onOpenChange,
}: RelevantProjectDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-6">{project?.title ?? "Project"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {project && (
              <>
                <Badge variant="outline" className="gap-1 text-[10px] capitalize">
                  <SourceIcon source={project.source} />
                  {SOURCE_LABEL[project.source]}
                </Badge>
                <span>{Math.round((project.relevanceScore ?? 0) * 100)}% relevance</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {project?.summary ? (
          <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">
            {project.summary}
          </p>
        ) : null}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-muted/20 p-4">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
            {project?.details ?? "No additional detail indexed for this entry."}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
