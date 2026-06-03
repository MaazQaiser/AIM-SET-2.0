"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { cn } from "@/lib/cn";

export type CallsViewMode = "list" | "cards";

interface CallsViewToggleProps {
  view: CallsViewMode;
  onChange: (view: CallsViewMode) => void;
  className?: string;
}

export function CallsViewToggle({ view, onChange, className }: CallsViewToggleProps) {
  return (
    <fieldset
      className={cn("inline-flex rounded-lg border border-border bg-muted/30 p-0.5", className)}
      aria-label="Calls layout"
    >
      <Button
        type="button"
        variant={view === "list" ? "dark" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        type="button"
        variant={view === "cards" ? "dark" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={() => onChange("cards")}
        aria-pressed={view === "cards"}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Cards</span>
      </Button>
    </fieldset>
  );
}
