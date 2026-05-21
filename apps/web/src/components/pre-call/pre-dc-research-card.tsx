"use client";

import { Building2 } from "lucide-react";
import { BriefDetailAccordion, BriefDetailCard } from "@/components/pre-call/brief-detail-card";
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
  title = "Lead research",
}: PreDcResearchCardProps) {
  if (sections.length === 0) return null;

  return (
    <BriefDetailCard
      title={title}
      icon={Building2}
      className={cn("border-primary/20", className)}
      scrollMaxHeight="14rem"
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
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                    {item.label}
                  </dt>
                  <dd className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
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
