"use client";

import { BriefDetailAccordion } from "@/components/pre-call/brief-detail-card";
import type { BriefResearchSection } from "@/lib/brief-types";

/** Lead research sections as top-level sidebar accordions (not nested under one parent). */
export function PreDcResearchAccordions({ sections }: { sections: BriefResearchSection[] }) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <BriefDetailAccordion key={section.title} title={section.title} defaultOpen={false} loud>
          <dl className="space-y-3">
            {section.items.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-[10px] font-semibold text-muted-foreground truncate">
                  {item.label}
                </dt>
                  <dd className="text-[0.9375rem] font-medium text-foreground leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </BriefDetailAccordion>
      ))}
    </>
  );
}
