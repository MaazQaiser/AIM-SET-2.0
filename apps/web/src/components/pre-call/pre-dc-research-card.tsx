"use client";

import { Building2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BriefResearchSection } from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { useState } from "react";

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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.title, i < 2]))
  );

  if (sections.length === 0) return null;

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {sections.map((section) => {
          const open = openSections[section.title] ?? false;
          return (
            <div key={section.title} className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, [section.title]: !open }))
                }
              >
                {section.title}
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
                />
              </button>
              {open && (
                <div className="border-t border-border px-3 py-2 space-y-2.5 bg-muted/20">
                  {section.items.map((item) => (
                    <div key={item.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
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
