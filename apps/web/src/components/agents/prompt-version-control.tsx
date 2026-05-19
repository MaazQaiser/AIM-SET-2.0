"use client";

import { useState } from "react";
import { Tag, RotateCcw, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { PromptVersion } from "@/types/agents";
import { cn } from "@/lib/cn";

interface PromptVersionControlProps {
  versions: PromptVersion[];
  onRollback?: (version: PromptVersion) => void;
}

export function PromptVersionControl({ versions, onRollback }: PromptVersionControlProps) {
  const [open, setOpen] = useState(false);
  const active = versions.find((v) => v.is_active);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Prompt Versions</span>
        </div>
        {active && (
          <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
            Active: v{active.version}
          </Badge>
        )}
      </div>

      <div className="divide-y rounded-md border">
        {versions.map((v) => (
          <div key={v.version} className={cn("flex items-start gap-3 px-4 py-3", v.is_active && "bg-primary/5")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-medium">v{v.version}</span>
                <span className="text-xs text-muted-foreground">· {v.label}</span>
                {v.is_active && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground">Active</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.changelog}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Deployed {new Date(v.deployed_at).toLocaleDateString()} · reviewed by {v.reviewed_by}
              </p>
            </div>
            {!v.is_active && onRollback && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => onRollback(v)}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Rollback
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
