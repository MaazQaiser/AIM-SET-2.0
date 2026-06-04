"use client";

import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  BriefDetailAccordion,
  BRIEF_CARD_LAYOUT_CLASS,
  BRIEF_SIDEBAR_CARD_SCROLL_MAX,
  briefCardShellClass,
  briefScrollBodyClassName,
  briefStickyHeaderClassName,
} from "@/components/pre-call/brief-detail-card";
import { PreDcResearchAccordions } from "@/components/pre-call/pre-dc-research-accordions";
import type { BriefWidgetProps } from "@/lib/dashboard/widget-registry";
import type { WidgetSpec } from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";

interface PreDcCustomerInfoPanelProps {
  widgets: WidgetSpec<BriefWidgetProps>[];
  widgetProps: BriefWidgetProps;
}

/** Left sidebar: research sections + account context, collapsed by default. */
export function PreDcCustomerInfoPanel({ widgets, widgetProps }: PreDcCustomerInfoPanelProps) {
  const researchSections = widgetProps.brief.researchSections ?? [];
  const hasResearch = researchSections.length > 0;
  const otherWidgets = widgets.filter((w) => w.id !== "brief.research");

  if (!hasResearch && otherWidgets.length === 0) return null;

  return (
    <Card
      className={cn(briefCardShellClass, BRIEF_CARD_LAYOUT_CLASS)}
      style={{ maxHeight: BRIEF_SIDEBAR_CARD_SCROLL_MAX }}
    >
      <CardHeader className={briefStickyHeaderClassName}>
        <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-foreground" />
          Customer & account
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(briefScrollBodyClassName("default", true), "space-y-2")}>
        {hasResearch && <PreDcResearchAccordions sections={researchSections} />}
        {otherWidgets.map((spec) => (
          <BriefDetailAccordion key={spec.id} title={spec.title} defaultOpen={false} loud>
            {spec.render(widgetProps, { embedded: true })}
          </BriefDetailAccordion>
        ))}
      </CardContent>
    </Card>
  );
}
