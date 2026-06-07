"use client";

import { Building2 } from "lucide-react";
import { BriefDetailAccordion, BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import type { BriefResearchSection } from "@/lib/brief-types";
import { cn } from "@/lib/cn";

interface PreDcResearchCardProps {
  sections: BriefResearchSection[];
  className?: string;
  title?: string;
  embedded?: boolean;
}

export function PreDcResearchCard({
  sections,
  className,
  title = "Lead research",
  embedded = false,
}: PreDcResearchCardProps) {
  if (sections.length === 0) return null;

  return (
    <BriefDetailCard
      title={title}
      icon={Building2}
      className={cn("border-primary/20", className)}
      scrollMaxHeight="14rem"
      embedded={embedded}
      hideEmbeddedTitle={embedded}
      sourceInfo={{
        source: title.startsWith("Post-DC") ? "Imported Post-DC notes" : "Imported Pre-DC notes",
        detail: title.startsWith("Post-DC")
          ? "These fields come directly from the uploaded Post-DC notes. The AI does not rewrite them here."
          : "These fields come directly from the uploaded Pre-DC row or manual lead form. The AI uses them as grounding for other sections.",
      }}
    >
      <div className="space-y-2">
        {sections.map((section) => (
          <BriefDetailAccordion
            key={section.title}
            title={section.title}
            summary={`${section.items.length} field${section.items.length === 1 ? "" : "s"}`}
          >
            <dl className="space-y-2.5">
              {section.items.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="type-caption font-medium text-muted-foreground truncate">
                    {item.label}
                  </dt>
                  <dd className="type-body text-foreground/90 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </BriefDetailAccordion>
        ))}
      </div>
    </BriefDetailCard>
  );
}
