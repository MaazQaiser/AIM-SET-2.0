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
import {
  isPostDcContextAccordionWidget,
  isPostDcOverviewWidget,
  type PostDcWidgetProps,
  type WidgetSpec,
} from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";

interface PostDcContextPanelProps {
  widgets: WidgetSpec<PostDcWidgetProps>[];
  widgetProps: PostDcWidgetProps;
  embedded?: boolean;
}

/** Left sidebar: account context and reference accordions. */
export function PostDcContextPanel({
  widgets,
  widgetProps,
  embedded = false,
}: PostDcContextPanelProps) {
  const overviewWidgets = widgets.filter((w) => isPostDcOverviewWidget(w.id));
  const accordionWidgets = widgets.filter((w) => isPostDcContextAccordionWidget(w.id));

  if (overviewWidgets.length === 0 && accordionWidgets.length === 0) return null;

  const scrollMax = embedded ? "max-h-[min(70vh,640px)]" : BRIEF_SIDEBAR_CARD_SCROLL_MAX;

  return (
    <div className={cn("flex min-w-0 flex-col gap-5", embedded && "gap-4")}>
      {overviewWidgets.length > 0 ? (
        <Card
          className={cn(briefCardShellClass, BRIEF_CARD_LAYOUT_CLASS)}
          style={{ maxHeight: scrollMax }}
        >
          <CardHeader className={briefStickyHeaderClassName}>
            <CardTitle className="type-panel-title flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-foreground" />
              Lead overview
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(briefScrollBodyClassName("default", true), "space-y-2")}>
            {overviewWidgets.map((spec) => (
              <BriefDetailAccordion key={spec.id} title={spec.title} defaultOpen={false} loud>
                {spec.render(widgetProps, { embedded: true })}
              </BriefDetailAccordion>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {accordionWidgets.length > 0 ? (
        <Card className={cn(briefCardShellClass, BRIEF_CARD_LAYOUT_CLASS)}>
          <CardContent className={cn(briefScrollBodyClassName("default", true), "space-y-2 pt-4")}>
            {accordionWidgets.map((spec) => (
              <BriefDetailAccordion
                key={spec.id}
                title={spec.title}
                defaultOpen={false}
                loud
              >
                {spec.render(widgetProps, { embedded: true })}
              </BriefDetailAccordion>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
