"use client";

import { Building2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BriefResearchSection } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PreDcResearchCardProps {
  sections: BriefResearchSection[];
  className?: string;
  title?: string;
}

export function PreDcResearchCard({
  sections,
  className,
  title = "Lead research (Pre-DC import)",
}: PreDcResearchCardProps) {
  const { compact, wide } = useWidgetSize();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.title, i < 2]))
  );

  if (sections.length === 0) return null;

  return (
    <Card className={cn("h-full border-primary/20", className)}>
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          wide ? "grid grid-cols-2 gap-2" : "space-y-2"
        )}
      >
        {sections.map((section) => {
          const open = openSections[section.title] ?? false;
          return (
            <div
              key={section.title}
              className="rounded-lg border border-border overflow-hidden min-w-0"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40 min-w-0"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, [section.title]: !open }))
                }
              >
                <span className="truncate min-w-0">{section.title}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    open && "rotate-180"
                  )}
                />
              </button>
              {open && (
                <div className="border-t border-border px-3 py-2 space-y-2.5 bg-muted/20">
                  {section.items.map((item) => (
                    <div key={item.label} className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                        {item.label}
                      </p>
                      <p
                        className={cn(
                          "text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words",
                          compact && "line-clamp-4"
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
